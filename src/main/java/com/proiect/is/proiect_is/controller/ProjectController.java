package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.dto.CreateProjectRequest;
import com.proiect.is.proiect_is.model.*;
import com.proiect.is.proiect_is.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app"})
public class ProjectController {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectInvitationRepository projectInvitationRepository;
    private final UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private FeedChannelRepository feedChannelRepository;

    @Autowired
    private FeedMessageRepository feedMessageRepository;

    @Autowired
    private PollRepository pollRepository;

    @Autowired
    private PollVoteRepository pollVoteRepository;

    @Autowired
    private ProjectRoleRepository projectRoleRepository;

    @Autowired
    private ProjectLinkRepository projectLinkRepository;

    @Autowired
    public ProjectController(
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            ProjectInvitationRepository projectInvitationRepository,
            UserRepository userRepository
    ) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.projectInvitationRepository = projectInvitationRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Project>> getUserProjects(@PathVariable Long userId) {
        List<Project> projects = projectRepository.findAccessibleProjects(userId);
        return ResponseEntity.ok(projects);
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<Project> getProjectById(@PathVariable Long projectId) {
        return projectRepository.findById(projectId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{projectId}/members")
    public ResponseEntity<List<ProjectMember>> getProjectMembers(@PathVariable Long projectId) {
        List<ProjectMember> members = projectMemberRepository.findByProjectId(projectId);
        return ResponseEntity.ok(members);
    }

    @PostMapping("/{projectId}/invite")
    public ResponseEntity<ProjectInvitation> inviteUser(@PathVariable Long projectId,
                                                         @RequestBody Map<String, Long> body) {
        Long invitedUserId = body.get("userId");
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        User invitedUser = userRepository.findById(invitedUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check if already a member
        boolean alreadyMember = projectMemberRepository.findByProjectId(projectId)
                .stream().anyMatch(m -> m.getUser().getId().equals(invitedUserId));
        if (alreadyMember) return ResponseEntity.badRequest().build();

        LocalDateTime now = LocalDateTime.now();
        ProjectInvitation invitation = new ProjectInvitation();
        invitation.setProject(project);
        invitation.setInvitedUser(invitedUser);
        invitation.setStatus("PENDING");
        invitation.setCreatedAt(now);
        invitation.setExpiresAt(now.plusHours(48));
        ProjectInvitation saved = projectInvitationRepository.save(invitation);
        return ResponseEntity.ok(saved);
    }

    @PostMapping
    public ResponseEntity<Project> createProject(@RequestBody CreateProjectRequest request) {
        User owner = userRepository.findById(request.getOwnerId())
                .orElseThrow(() -> new RuntimeException("Owner not found"));

        LocalDateTime now = LocalDateTime.now();

        Project project = new Project();
        project.setName(request.getName());
        project.setDescription(request.getDescription());
        project.setOwner(owner);
        project.setCreatedAt(now);

        Project savedProject = projectRepository.save(project);

        ProjectMember ownerMember = new ProjectMember();
        ownerMember.setProject(savedProject);
        ownerMember.setUser(owner);
        ownerMember.setRole("OWNER");
        ownerMember.setJoinedAt(now);
        projectMemberRepository.save(ownerMember);

        if (request.getInvitedUserIds() != null) {
            for (Long invitedUserId : request.getInvitedUserIds()) {
                if (invitedUserId.equals(owner.getId())) continue;

                userRepository.findById(invitedUserId).ifPresent(invitedUser -> {
                    ProjectInvitation invitation = new ProjectInvitation();
                    invitation.setProject(savedProject);
                    invitation.setInvitedUser(invitedUser);
                    invitation.setStatus("PENDING");
                    invitation.setCreatedAt(now);
                    invitation.setExpiresAt(now.plusHours(48));
                    projectInvitationRepository.save(invitation);
                });
            }
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(savedProject);
    }

    @GetMapping("/invitations/user/{userId}")
    public ResponseEntity<List<ProjectInvitation>> getPendingInvitations(@PathVariable Long userId) {
        List<ProjectInvitation> invitations = projectInvitationRepository.findActivePendingInvitations(userId, LocalDateTime.now());
        return ResponseEntity.ok(invitations);
    }

    @PostMapping("/invitations/{invitationId}/accept")
    public ResponseEntity<Void> acceptInvitation(@PathVariable Long invitationId) {
        ProjectInvitation invitation = projectInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new RuntimeException("Invitation not found"));

        if (!"PENDING".equals(invitation.getStatus()) || invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            invitation.setStatus("EXPIRED");
            projectInvitationRepository.save(invitation);
            return ResponseEntity.badRequest().build();
        }

        invitation.setStatus("ACCEPTED");
        projectInvitationRepository.save(invitation);

        ProjectMember member = new ProjectMember();
        member.setProject(invitation.getProject());
        member.setUser(invitation.getInvitedUser());
        member.setRole("MEMBER");
        member.setJoinedAt(LocalDateTime.now());
        projectMemberRepository.save(member);

        return ResponseEntity.ok().build();
    }

    @PostMapping("/invitations/{invitationId}/decline")
    public ResponseEntity<Void> declineInvitation(@PathVariable Long invitationId) {
        ProjectInvitation invitation = projectInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new RuntimeException("Invitation not found"));

        invitation.setStatus("DECLINED");
        projectInvitationRepository.save(invitation);

        return ResponseEntity.ok().build();
    }

    // --- LEAVE PROJECT ---
    @PostMapping("/{projectId}/leave")
    @Transactional
    public ResponseEntity<?> leaveProject(@PathVariable Long projectId, @RequestParam Long userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Proiectul nu a fost găsit."));

        ProjectMember member = projectMemberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new RuntimeException("Nu ești membru în acest proiect."));

        if (project.getOwner() != null && project.getOwner().getId().equals(userId)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "Proprietarul (Owner) nu poate părăsi proiectul direct. Dacă dorești să renunți la el, poți șterge proiectul."
            ));
        }

        if ("OWNER".equalsIgnoreCase(member.getRole())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "Un membru cu rol de OWNER nu poate părăsi proiectul direct. Șterge proiectul dacă ești proprietarul acestuia."
            ));
        }

        projectMemberRepository.delete(member);
        return ResponseEntity.ok(Map.of("message", "Ai părăsit proiectul cu succes."));
    }

    // --- DELETE PROJECT (OWNER ONLY) ---
    @DeleteMapping("/{projectId}")
    @Transactional
    public ResponseEntity<?> deleteProject(@PathVariable Long projectId, @RequestParam Long userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Proiectul nu a fost găsit."));

        if (project.getOwner() == null || !project.getOwner().getId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "message", "Doar proprietarul (Owner) are permisiunea de a șterge acest proiect!"
            ));
        }

        // 1. Delete tasks
        List<Task> tasks = taskRepository.findByProjectId(projectId);
        if (!tasks.isEmpty()) taskRepository.deleteAll(tasks);

        // 2. Delete poll votes & polls
        List<Poll> polls = pollRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        for (Poll p : polls) {
            List<PollVote> votes = pollVoteRepository.findByPollId(p.getId());
            if (!votes.isEmpty()) pollVoteRepository.deleteAll(votes);
        }
        if (!polls.isEmpty()) pollRepository.deleteAll(polls);

        // 3. Delete feed messages & channels
        List<FeedMessage> messages = feedMessageRepository.findByProjectIdOrderBySentAtAsc(projectId);
        if (!messages.isEmpty()) feedMessageRepository.deleteAll(messages);

        List<FeedChannel> channels = feedChannelRepository.findByProjectId(projectId);
        if (!channels.isEmpty()) feedChannelRepository.deleteAll(channels);

        // 4. Delete project links
        List<ProjectLink> links = projectLinkRepository.findByProjectIdOrderByAddedAtDesc(projectId);
        if (!links.isEmpty()) projectLinkRepository.deleteAll(links);

        // 5. Delete project roles
        List<ProjectRole> roles = projectRoleRepository.findByProjectIdOrderByIdAsc(projectId);
        if (!roles.isEmpty()) projectRoleRepository.deleteAll(roles);

        // 6. Delete project invitations
        List<ProjectInvitation> invitations = projectInvitationRepository.findByProjectId(projectId);
        if (!invitations.isEmpty()) projectInvitationRepository.deleteAll(invitations);

        // 7. Delete project members
        List<ProjectMember> members = projectMemberRepository.findByProjectId(projectId);
        if (!members.isEmpty()) projectMemberRepository.deleteAll(members);

        // 8. Delete project entity
        projectRepository.delete(project);

        return ResponseEntity.ok(Map.of("message", "Proiectul a fost șters definitiv."));
    }
}