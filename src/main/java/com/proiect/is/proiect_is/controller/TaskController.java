package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.Task;
import com.proiect.is.proiect_is.repository.ProjectRepository;
import com.proiect.is.proiect_is.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @GetMapping("/my-tasks/{userId}")
    public List<Task> getMyTasks(@PathVariable Long userId) {
        return taskRepository.findByAssigneeId(userId);
    }

    @GetMapping("/given-tasks/{userId}")
    public List<Task> getGivenTasks(@PathVariable Long userId) {
        return taskRepository.findByCreatorId(userId);
    }

    @GetMapping("/project/{projectId}")
    public List<Task> getProjectTasks(@PathVariable Long projectId) {
        return taskRepository.findByProjectId(projectId);
    }

    @PostMapping
    public Task createTask(@RequestBody Task task) {
        task.setCreationDate(LocalDateTime.now());
        task.setStatus("PRIMIT");
        if (task.getProject() == null && task.getProjectId() != null) {
            projectRepository.findById(task.getProjectId()).ifPresent(task::setProject);
        }
        Task saved = taskRepository.save(task);

        if (saved.getProject() != null && saved.getProject().getId() != null) {
            try {
                messagingTemplate.convertAndSend("/topic/projects/" + saved.getProject().getId() + "/tasks", saved);
            } catch (Exception ignored) {}
        }
        return saved;
    }

    @PutMapping("/{taskId}/status")
    public ResponseEntity<?> updateTaskStatus(@PathVariable Long taskId, @RequestBody Map<String, String> body) {
        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }

        String newStatus = body.get("status");
        task.setStatus(newStatus);
        Task saved = taskRepository.save(task);

        if (saved.getProject() != null && saved.getProject().getId() != null) {
            try {
                messagingTemplate.convertAndSend("/topic/projects/" + saved.getProject().getId() + "/tasks", saved);
            } catch (Exception ignored) {}
        }

        return ResponseEntity.ok(saved);
    }
}