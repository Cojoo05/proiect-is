package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.Project;
import com.proiect.is.proiect_is.model.ProjectMember;
import com.proiect.is.proiect_is.model.ProjectRole;
import com.proiect.is.proiect_is.repository.ProjectMemberRepository;
import com.proiect.is.proiect_is.repository.ProjectRepository;
import com.proiect.is.proiect_is.repository.ProjectRoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app"})
public class ProjectRoleController {

    private final ProjectRoleRepository roleRepo;
    private final ProjectMemberRepository memberRepo;
    private final ProjectRepository projectRepo;

    @Autowired
    private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    @Autowired
    public ProjectRoleController(ProjectRoleRepository roleRepo,
                                 ProjectMemberRepository memberRepo,
                                 ProjectRepository projectRepo) {
        this.roleRepo = roleRepo;
        this.memberRepo = memberRepo;
        this.projectRepo = projectRepo;
    }

    // --- GET ALL ROLES (seeds defaults if none exist) ---
    @GetMapping("/{projectId}/roles")
    public ResponseEntity<List<ProjectRole>> getProjectRoles(@PathVariable Long projectId) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        List<ProjectRole> roles = roleRepo.findByProjectIdOrderByIdAsc(projectId);
        if (roles.isEmpty()) {
            roles = seedDefaultRoles(project);
        }
        return ResponseEntity.ok(roles);
    }

    private List<ProjectRole> seedDefaultRoles(Project project) {
        List<ProjectRole> defaults = new ArrayList<>();

        // Admin
        ProjectRole admin = new ProjectRole();
        admin.setProject(project);
        admin.setName("Admin");
        admin.setDescription("Acces complet la proiect și administrare membri.");
        admin.setColor("#dc2626");
        admin.setCanCreateTasks(true);
        admin.setCanManageTasks(true);
        admin.setCanCreateChannels(true);
        admin.setCanSendMessages(true);
        admin.setCanCreatePolls(true);
        admin.setCanVotePolls(true);
        admin.setCanManageFiles(true);
        admin.setCanInviteMembers(true);
        admin.setAllowedChannels("ALL");
        defaults.add(roleRepo.save(admin));

        // Developer / Contributor
        ProjectRole dev = new ProjectRole();
        dev.setProject(project);
        dev.setName("Developer");
        dev.setDescription("Poate crea taskuri, participa la discuții și partaja fișiere.");
        dev.setColor("#2563eb");
        dev.setCanCreateTasks(true);
        dev.setCanManageTasks(true);
        dev.setCanCreateChannels(false);
        dev.setCanSendMessages(true);
        dev.setCanCreatePolls(true);
        dev.setCanVotePolls(true);
        dev.setCanManageFiles(true);
        dev.setCanInviteMembers(false);
        dev.setAllowedChannels("ALL");
        defaults.add(roleRepo.save(dev));

        // Viewer / Observator
        ProjectRole viewer = new ProjectRole();
        viewer.setProject(project);
        viewer.setName("Viewer");
        viewer.setDescription("Doar vizualizare și participare la voturi/discuții.");
        viewer.setColor("#64748b");
        viewer.setCanCreateTasks(false);
        viewer.setCanManageTasks(false);
        viewer.setCanCreateChannels(false);
        viewer.setCanSendMessages(true);
        viewer.setCanCreatePolls(false);
        viewer.setCanVotePolls(true);
        viewer.setCanManageFiles(false);
        viewer.setCanInviteMembers(false);
        viewer.setAllowedChannels("ALL");
        defaults.add(roleRepo.save(viewer));

        return defaults;
    }

    // --- CREATE ROLE ---
    @PostMapping("/{projectId}/roles")
    public ResponseEntity<ProjectRole> createRole(@PathVariable Long projectId,
                                                  @RequestBody ProjectRole request) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        ProjectRole role = new ProjectRole();
        role.setProject(project);
        role.setName(request.getName());
        role.setDescription(request.getDescription());
        role.setColor(request.getColor() != null ? request.getColor() : "#5a3d5c");
        role.setCanCreateTasks(request.isCanCreateTasks());
        role.setCanManageTasks(request.isCanManageTasks());
        role.setCanCreateChannels(request.isCanCreateChannels());
        role.setCanSendMessages(request.isCanSendMessages());
        role.setCanCreatePolls(request.isCanCreatePolls());
        role.setCanVotePolls(request.isCanVotePolls());
        role.setCanManageFiles(request.isCanManageFiles());
        role.setCanInviteMembers(request.isCanInviteMembers());
        role.setAllowedChannels(request.getAllowedChannels() != null ? request.getAllowedChannels() : "ALL");

        ProjectRole saved = roleRepo.save(role);
        try {
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/roles", saved);
        } catch (Exception ignored) {}
        return ResponseEntity.ok(saved);
    }

    // --- UPDATE ROLE ---
    @PutMapping("/{projectId}/roles/{roleId}")
    public ResponseEntity<ProjectRole> updateRole(@PathVariable Long projectId,
                                                  @PathVariable Long roleId,
                                                  @RequestBody ProjectRole request) {
        ProjectRole role = roleRepo.findById(roleId)
                .orElseThrow(() -> new RuntimeException("Role not found"));

        role.setName(request.getName());
        role.setDescription(request.getDescription());
        if (request.getColor() != null) role.setColor(request.getColor());
        role.setCanCreateTasks(request.isCanCreateTasks());
        role.setCanManageTasks(request.isCanManageTasks());
        role.setCanCreateChannels(request.isCanCreateChannels());
        role.setCanSendMessages(request.isCanSendMessages());
        role.setCanCreatePolls(request.isCanCreatePolls());
        role.setCanVotePolls(request.isCanVotePolls());
        role.setCanManageFiles(request.isCanManageFiles());
        role.setCanInviteMembers(request.isCanInviteMembers());
        if (request.getAllowedChannels() != null) {
            role.setAllowedChannels(request.getAllowedChannels());
        }

        ProjectRole saved = roleRepo.save(role);
        try {
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/roles", saved);
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/members", (Object) Map.of("action", "roles_updated"));
        } catch (Exception ignored) {}

        return ResponseEntity.ok(saved);
    }

    // --- DELETE ROLE ---
    @Transactional
    @DeleteMapping("/{projectId}/roles/{roleId}")
    public ResponseEntity<Void> deleteRole(@PathVariable Long projectId, @PathVariable Long roleId) {
        ProjectRole role = roleRepo.findById(roleId)
                .orElseThrow(() -> new RuntimeException("Role not found"));

        // Detach role from any members using it
        List<ProjectMember> members = memberRepo.findByProjectId(projectId);
        for (ProjectMember m : members) {
            if (m.getProjectRole() != null && m.getProjectRole().getId().equals(roleId)) {
                m.setProjectRole(null);
                m.setRole("MEMBER");
                memberRepo.save(m);
            }
        }

        roleRepo.delete(role);
        try {
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/roles", (Object) Map.of("action", "delete", "roleId", roleId));
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/members", (Object) Map.of("action", "roles_updated"));
        } catch (Exception ignored) {}

        return ResponseEntity.ok().build();
    }

    // --- ASSIGN ROLE TO MEMBER ---
    @PutMapping("/{projectId}/members/{memberId}/role")
    public ResponseEntity<ProjectMember> assignRoleToMember(@PathVariable Long projectId,
                                                            @PathVariable Long memberId,
                                                            @RequestBody Map<String, Object> body) {
        ProjectMember member = memberRepo.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        if ("OWNER".equalsIgnoreCase(member.getRole())) {
            return ResponseEntity.badRequest().build(); // Owner role cannot be changed
        }

        if (body.containsKey("roleId") && body.get("roleId") != null) {
            Long roleId = Long.valueOf(body.get("roleId").toString());
            ProjectRole projectRole = roleRepo.findById(roleId)
                    .orElseThrow(() -> new RuntimeException("Role not found"));
            member.setProjectRole(projectRole);
            member.setRole(projectRole.getName());
        } else if (body.containsKey("roleName")) {
            String roleName = body.get("roleName").toString();
            member.setRole(roleName);
            member.setProjectRole(null);
        }

        ProjectMember saved = memberRepo.save(member);
        try {
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/members", saved);
        } catch (Exception ignored) {}

        return ResponseEntity.ok(saved);
    }

    // --- REMOVE MEMBER FROM PROJECT ---
    @DeleteMapping("/{projectId}/members/{memberId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long projectId,
                                             @PathVariable Long memberId) {
        ProjectMember member = memberRepo.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        if ("OWNER".equalsIgnoreCase(member.getRole())) {
            return ResponseEntity.badRequest().build(); // Owner cannot be removed
        }

        memberRepo.delete(member);
        try {
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/members", (Object) Map.of("action", "remove", "memberId", memberId));
        } catch (Exception ignored) {}

        return ResponseEntity.ok().build();
    }
}
