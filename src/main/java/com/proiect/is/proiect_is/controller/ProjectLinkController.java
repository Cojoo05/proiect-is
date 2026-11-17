package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.Project;
import com.proiect.is.proiect_is.model.ProjectLink;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.ProjectLinkRepository;
import com.proiect.is.proiect_is.repository.ProjectRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app"})
public class ProjectLinkController {

    private final ProjectLinkRepository linkRepo;
    private final ProjectRepository projectRepo;
    private final UserRepository userRepo;

    @Autowired
    public ProjectLinkController(ProjectLinkRepository linkRepo,
                                  ProjectRepository projectRepo,
                                  UserRepository userRepo) {
        this.linkRepo = linkRepo;
        this.projectRepo = projectRepo;
        this.userRepo = userRepo;
    }

    @GetMapping("/{projectId}/links")
    public ResponseEntity<List<ProjectLink>> getLinks(@PathVariable Long projectId) {
        return ResponseEntity.ok(linkRepo.findByProjectIdOrderByAddedAtDesc(projectId));
    }

    @PostMapping("/{projectId}/links")
    public ResponseEntity<ProjectLink> addLink(@PathVariable Long projectId,
                                                @RequestBody Map<String, Object> body) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Long addedById = Long.valueOf(body.get("addedById").toString());
        User addedBy = userRepo.findById(addedById)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ProjectLink link = new ProjectLink();
        link.setProject(project);
        link.setAddedBy(addedBy);
        link.setUrl(body.get("url").toString());
        link.setLabel(body.get("label").toString());
        if (body.containsKey("mimeType") && body.get("mimeType") != null) {
            link.setMimeType(body.get("mimeType").toString());
        }
        link.setAddedAt(LocalDateTime.now());

        return ResponseEntity.ok(linkRepo.save(link));
    }

    @DeleteMapping("/{projectId}/links/{linkId}")
    public ResponseEntity<Void> deleteLink(@PathVariable Long projectId,
                                            @PathVariable Long linkId) {
        linkRepo.deleteById(linkId);
        return ResponseEntity.ok().build();
    }
}
