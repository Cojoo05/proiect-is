package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.*;
import com.proiect.is.proiect_is.repository.*;
import com.proiect.is.proiect_is.service.SystemRoleService;
import com.proiect.is.proiect_is.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app"})
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SystemRoleService systemRoleService;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    @Autowired
    private ProjectInvitationRepository projectInvitationRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskBucketRepository taskBucketRepository;

    @Autowired
    private FeedMessageRepository feedMessageRepository;

    @Autowired
    private PollRepository pollRepository;

    @Autowired
    private PollVoteRepository pollVoteRepository;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private CalendarEventRepository calendarEventRepository;

    @Autowired
    private AppNotificationRepository appNotificationRepository;

    private void enrichUserRole(User user) {
        if (user == null) return;
        boolean hasAdmin = systemRoleService.hasAdminAccess(user.getRole());
        user.setHasAdminAccess(hasAdmin);
    }

    @GetMapping
    public List<User> getAllUsers() {
        List<User> users = userRepository.findAll().stream()
                .filter(u -> !Boolean.TRUE.equals(u.getArchived()))
                .toList();
        users.forEach(this::enrichUserRole);
        return users;
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody User user) {
        // Un cont nou creat primește strict rolul de bază "User", fără drepturi de admin
        String requestedRole = user.getRole();
        if (requestedRole == null || requestedRole.isBlank() || systemRoleService.hasAdminAccess(requestedRole)) {
            user.setRole("User");
        } else {
            user.setRole(requestedRole.trim());
        }

        user.setHasAdminAccess(false);
        user.setArchived(false);

        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
            user.setPassword(encoder.encode(user.getPassword()));
        }

        User saved = userRepository.save(user);
        saved.setHasAdminAccess(false);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody User userDetails) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User-ul nu a fost găsit cu id: " + id));

        // Safety check if changing this user's role from full access to non-full access
        boolean currentlyHasAdmin = systemRoleService.hasAdminAccess(user.getRole());
        boolean targetHasAdmin = systemRoleService.hasAdminAccess(userDetails.getRole());

        if (currentlyHasAdmin && !targetHasAdmin) {
            long totalFullAccessUsers = userRepository.findAll().stream()
                    .filter(u -> !Boolean.TRUE.equals(u.getArchived()) && systemRoleService.hasAdminAccess(u.getRole()))
                    .count();

            if (totalFullAccessUsers <= 1) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Nu poți retrage rolul de administrator al acestui utilizator! Este ultimul utilizator cu drepturi depline din sistem."
                ));
            }
        }

        user.setUsername(userDetails.getUsername());
        user.setEmail(userDetails.getEmail());
        if (userDetails.getRole() != null && !userDetails.getRole().trim().isEmpty()) {
            user.setRole(userDetails.getRole().trim());
        }

        // Only update password if a new password is provided
        if (userDetails.getPassword() != null && !userDetails.getPassword().trim().isEmpty()) {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
            user.setPassword(encoder.encode(userDetails.getPassword()));
        }

        User saved = userRepository.save(user);
        enrichUserRole(saved);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{id}/projects-summary")
    public ResponseEntity<?> getUserProjectsSummary(@PathVariable Long id) {
        List<Project> owned = projectRepository.findByOwnerId(id);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Project p : owned) {
            List<ProjectMember> mems = projectMemberRepository.findByProjectId(p.getId());
            List<Map<String, Object>> memberList = mems.stream()
                    .filter(m -> !m.getUser().getId().equals(id) && !Boolean.TRUE.equals(m.getUser().getArchived()))
                    .map(m -> {
                        Map<String, Object> map = new LinkedHashMap<>();
                        map.put("id", m.getUser().getId());
                        map.put("username", m.getUser().getUsername());
                        map.put("email", m.getUser().getEmail());
                        return map;
                    })
                    .toList();

            Map<String, Object> projMap = new LinkedHashMap<>();
            projMap.put("id", p.getId());
            projMap.put("name", p.getName());
            projMap.put("members", memberList);
            result.add(projMap);
        }
        return ResponseEntity.ok(result);
    }

    public static class ArchiveUserRequest {
        private Long adminUserId;
        private Map<Long, Long> projectTransfers;

        public Long getAdminUserId() { return adminUserId; }
        public void setAdminUserId(Long adminUserId) { this.adminUserId = adminUserId; }
        public Map<Long, Long> getProjectTransfers() { return projectTransfers; }
        public void setProjectTransfers(Map<Long, Long> projectTransfers) { this.projectTransfers = projectTransfers; }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteUser(@PathVariable Long id, @RequestBody(required = false) ArchiveUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User-ul nu a fost găsit cu id: " + id));

        // Safety check if deleting this user leaves 0 full access admins
        if (systemRoleService.hasAdminAccess(user.getRole())) {
            long totalFullAccessUsers = userRepository.findAll().stream()
                    .filter(u -> !Boolean.TRUE.equals(u.getArchived()) && systemRoleService.hasAdminAccess(u.getRole()))
                    .count();

            if (totalFullAccessUsers <= 1) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Nu poți șterge acest utilizator! Este ultimul utilizator cu drepturi depline din sistem."
                ));
            }
        }

        // 1. Transfer ownership for owned projects
        List<Project> ownedProjects = projectRepository.findByOwnerId(id);
        for (Project project : ownedProjects) {
            Long newOwnerId = null;
            if (request != null && request.getProjectTransfers() != null) {
                newOwnerId = request.getProjectTransfers().get(project.getId());
            }
            if (newOwnerId == null && request != null) {
                newOwnerId = request.getAdminUserId();
            }
            if (newOwnerId == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Trebuie să selectezi un nou proprietar pentru proiectul: " + project.getName()
                ));
            }

            final Long targetOwnerId = newOwnerId;
            User newOwner = userRepository.findById(targetOwnerId)
                    .orElseThrow(() -> new RuntimeException("Noul proprietar nu a fost găsit cu id: " + targetOwnerId));

            project.setOwner(newOwner);
            projectRepository.save(project);

            // Check if newOwner is already a member
            Optional<ProjectMember> existingMemberOpt = projectMemberRepository.findByProjectIdAndUserId(project.getId(), newOwner.getId());
            if (existingMemberOpt.isPresent()) {
                ProjectMember mem = existingMemberOpt.get();
                mem.setRole("OWNER");
                projectMemberRepository.save(mem);
            } else {
                ProjectMember newMember = new ProjectMember();
                newMember.setProject(project);
                newMember.setUser(newOwner);
                newMember.setRole("OWNER");
                newMember.setJoinedAt(LocalDateTime.now());
                projectMemberRepository.save(newMember);
            }
        }

        // 2. Remove user from all project memberships
        List<ProjectMember> memberships = projectMemberRepository.findByUserId(id);
        if (!memberships.isEmpty()) {
            projectMemberRepository.deleteAll(memberships);
        }

        // 3. Delete invitations sent to this user
        List<ProjectInvitation> invitations = projectInvitationRepository.findByInvitedUserId(id);
        if (!invitations.isEmpty()) {
            projectInvitationRepository.deleteAll(invitations);
        }

        // 4. Delete user feed messages
        List<FeedMessage> feedMessages = feedMessageRepository.findBySenderId(id);
        if (!feedMessages.isEmpty()) {
            feedMessageRepository.deleteAll(feedMessages);
        }

        // 5. Unassign tasks assigned to this user
        List<Task> assignedTasks = taskRepository.findByAssigneeId(id);
        for (Task t : assignedTasks) {
            t.setAssignee(null);
        }
        if (!assignedTasks.isEmpty()) {
            taskRepository.saveAll(assignedTasks);
        }

        // 6. Reset task_buckets on tasks in user's buckets, then delete user's buckets
        List<TaskBucket> userBuckets = taskBucketRepository.findByOwnerIdOrderBySortOrderAscIdAsc(id);
        for (TaskBucket b : userBuckets) {
            List<Task> bucketTasks = taskRepository.findByBucketId(b.getId());
            for (Task bt : bucketTasks) {
                bt.setBucketId(null);
            }
            if (!bucketTasks.isEmpty()) {
                taskRepository.saveAll(bucketTasks);
            }
        }
        if (!userBuckets.isEmpty()) {
            taskBucketRepository.deleteAll(userBuckets);
        }

        // 7. Delete poll votes cast by this user
        List<PollVote> userVotes = pollVoteRepository.findByVoterId(id);
        if (!userVotes.isEmpty()) {
            pollVoteRepository.deleteAll(userVotes);
        }

        // 8. Delete polls created by this user
        List<Poll> userPolls = pollRepository.findByCreatedById(id);
        for (Poll p : userPolls) {
            List<PollVote> pollVotes = pollVoteRepository.findByPollId(p.getId());
            if (!pollVotes.isEmpty()) {
                pollVoteRepository.deleteAll(pollVotes);
            }
        }
        if (!userPolls.isEmpty()) {
            pollRepository.deleteAll(userPolls);
        }

        // 9. Delete personal notes
        List<Note> userNotes = noteRepository.findByCreatorId(id);
        if (!userNotes.isEmpty()) {
            noteRepository.deleteAll(userNotes);
        }

        // 10. Delete personal calendar events
        List<CalendarEvent> userEvents = calendarEventRepository.findByUserId(id);
        if (!userEvents.isEmpty()) {
            calendarEventRepository.deleteAll(userEvents);
        }

        // 11. Delete notifications
        List<AppNotification> userNotifs = appNotificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(id);
        if (!userNotifs.isEmpty()) {
            appNotificationRepository.deleteAll(userNotifs);
        }

        // 12. Soft-delete: mark user as archived
        user.setArchived(true);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Utilizatorul a fost arhivat și datele aferente au fost curățate cu succes!"));
    }

    // --- SINCRONIZARE GOOGLE ---
    @PostMapping("/{id}/sync-google")
    public ResponseEntity<?> syncGoogle(@PathVariable Long id, @RequestBody Map<String, String> body) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        String googleEmail = body.get("googleEmail");
        String googleId = body.get("googleId");

        if (googleEmail == null || googleEmail.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Adresa de email Google este obligatorie!"));
        }

        googleEmail = googleEmail.trim().toLowerCase();

        // Dacă adresa de email diferă de a altui utilizator, verificăm unicitatea
        Optional<User> existingEmailUser = userRepository.findByEmail(googleEmail);
        if (existingEmailUser.isPresent() && !existingEmailUser.get().getId().equals(user.getId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Această adresă de email Google este deja asociată altui cont!"));
        }

        // Actualizăm emailul contului la cel de Google conform instrucțiunii
        user.setEmail(googleEmail);
        user.setGoogleEmail(googleEmail);
        user.setGoogleId(googleId);
        user.setGoogleSynced(true);

        User saved = userRepository.save(user);
        enrichUserRole(saved);

        return ResponseEntity.ok(saved);
    }

    // --- DESINCRONIZARE GOOGLE (DOAR ADMIN) ---
    @PostMapping("/{id}/desync-google")
    public ResponseEntity<?> desyncGoogle(@PathVariable Long id, @RequestParam(required = false) Long adminId) {
        if (adminId != null) {
            User admin = userRepository.findById(adminId).orElse(null);
            enrichUserRole(admin);
            if (admin == null || !Boolean.TRUE.equals(admin.getHasAdminAccess())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Doar un administrator poate desincroniza contul Google!"));
            }
        }

        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        user.setGoogleSynced(false);
        user.setGoogleEmail(null);
        user.setGoogleId(null);

        User saved = userRepository.save(user);
        enrichUserRole(saved);

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody User loginData) {
        Optional<User> uOpt = userRepository.findByUsername(loginData.getUsername());
        if (uOpt.isPresent() && Boolean.TRUE.equals(uOpt.get().getArchived())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Acest cont a fost dezactivat/șters.");
        }

        boolean isValid = userService.checkLogin(loginData.getUsername(), loginData.getPassword());

        if (isValid) {
            return ResponseEntity.ok("Login successful");
        } else {
            return ResponseEntity.status(401).body("Invalid credentials");
        }
    }
}
