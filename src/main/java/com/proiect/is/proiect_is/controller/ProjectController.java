package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.dto.CreateProjectRequest;
import com.proiect.is.proiect_is.model.Project;
import com.proiect.is.proiect_is.model.ProjectMember;
import com.proiect.is.proiect_is.model.ProjectInvitation;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.ProjectMemberRepository;
import com.proiect.is.proiect_is.repository.ProjectInvitationRepository;
import com.proiect.is.proiect_is.repository.ProjectRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "http://localhost:5173")
public class ProjectController {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectInvitationRepository projectInvitationRepository;
    private final UserRepository userRepository;

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
}