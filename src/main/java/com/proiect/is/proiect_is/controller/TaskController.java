package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.AppNotification;
import com.proiect.is.proiect_is.model.Task;
import com.proiect.is.proiect_is.model.TaskBucket;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.AppNotificationRepository;
import com.proiect.is.proiect_is.repository.ProjectRepository;
import com.proiect.is.proiect_is.repository.TaskBucketRepository;
import com.proiect.is.proiect_is.repository.TaskRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private static final Object BUCKET_LOCK = new Object();
    private static final Set<String> VALID_STATUSES = Set.of("PRIMIT", "IN_LUCRU", "TERMINAT", "ANULAT");
    private static final String[] DEFAULT_BUCKETS = {"Săptămâna asta", "Săptămâna viitoare", "Pe mai târziu"};

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskBucketRepository bucketRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AppNotificationRepository appNotificationRepository;

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
        if (task.getDescription() == null) {
            task.setDescription("");
        }
        if (task.getProject() == null && task.getProjectId() != null) {
            projectRepository.findById(task.getProjectId()).ifPresent(task::setProject);
        }
        if (task.getCreator() != null && task.getCreator().getId() != null) {
            userRepository.findById(task.getCreator().getId()).ifPresent(task::setCreator);
        }
        if (task.getAssignee() != null && task.getAssignee().getId() != null) {
            userRepository.findById(task.getAssignee().getId()).ifPresent(task::setAssignee);
        }
        Task saved = taskRepository.save(task);
        broadcastProjectTask(saved);

        // Notificare când se atribuie un task altui utilizator (nu și dacă își dă singur)
        if (saved.getAssignee() != null && saved.getCreator() != null) {
            Long assigneeId = saved.getAssignee().getId();
            Long creatorId = saved.getCreator().getId();
            if (!assigneeId.equals(creatorId)) {
                String creatorName = saved.getCreator().getUsername() != null ? saved.getCreator().getUsername() : "Un utilizator";
                AppNotification notif = new AppNotification();
                notif.setRecipientUserId(assigneeId);
                notif.setSenderUserId(creatorId);
                notif.setSenderName(creatorName);
                notif.setType("task_assigned");
                notif.setTitle("Task nou primit");
                notif.setMessage(creatorName + " ți-a atribuit un task: \"" + saved.getTitle() + "\"");
                notif.setCreatedAt(LocalDateTime.now());
                notif.setIsRead(false);
                appNotificationRepository.save(notif);

                if (messagingTemplate != null) {
                    try {
                        messagingTemplate.convertAndSend("/topic/users/" + assigneeId + "/notifications", notif);
                    } catch (Exception ignored) {}
                }
            }
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
        broadcastProjectTask(saved);

        return ResponseEntity.ok(saved);
    }

    // --- UPDATE TASK (titlu, descriere, deadline, culoare, coloană, status/arhivare) ---
    @PutMapping("/{taskId}")
    public ResponseEntity<?> updateTask(@PathVariable Long taskId,
                                        @RequestParam Long userId,
                                        @RequestBody Map<String, Object> body) {
        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }

        boolean isAssignee = task.getAssignee() != null && userId.equals(task.getAssignee().getId());
        boolean isCreator = task.getCreator() != null && userId.equals(task.getCreator().getId());
        if (!isAssignee && !isCreator) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Nu ai permisiunea de a modifica acest task!"));
        }

        if (body.containsKey("title")) {
            Object t = body.get("title");
            if (t == null || t.toString().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Titlul este obligatoriu!"));
            }
            task.setTitle(t.toString().trim());
        }

        if (body.containsKey("description")) {
            Object d = body.get("description");
            task.setDescription(d == null ? "" : d.toString());
        }

        if (body.containsKey("dueLine")) {
            Object raw = body.get("dueLine");
            if (raw == null || raw.toString().trim().isEmpty()) {
                task.setDueLine(null);
            } else {
                try {
                    task.setDueLine(parseDueLine(raw.toString()));
                } catch (DateTimeParseException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Deadline invalid!"));
                }
            }
        }

        if (body.containsKey("color")) {
            Object c = body.get("color");
            if (c == null || c.toString().trim().isEmpty()) {
                task.setColor(null);
            } else {
                String color = c.toString().trim();
                if (!color.matches("^#[0-9a-fA-F]{3,8}$")) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Culoare invalidă!"));
                }
                task.setColor(color);
            }
        }

        if (body.containsKey("bucketId")) {
            Object b = body.get("bucketId");
            if (b == null) {
                task.setBucketId(null);
            } else {
                Long bucketId;
                try {
                    bucketId = Long.valueOf(b.toString());
                } catch (NumberFormatException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Coloană invalidă!"));
                }
                TaskBucket bucket = bucketRepository.findById(bucketId).orElse(null);
                if (bucket == null || task.getAssignee() == null
                        || !bucket.getOwnerId().equals(task.getAssignee().getId())) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Coloana aleasă nu există!"));
                }
                task.setBucketId(bucketId);
            }
        }

        if (body.containsKey("status")) {
            Object s = body.get("status");
            if (s == null || !VALID_STATUSES.contains(s.toString())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Status invalid!"));
            }
            task.setStatus(s.toString());
        }

        Task saved = taskRepository.save(task);
        broadcastProjectTask(saved);
        return ResponseEntity.ok(saved);
    }

    // --- BUCKETS (coloanele personale din Kanban: "Săptămâna asta" etc.) ---
    @GetMapping("/buckets/{userId}")
    public List<TaskBucket> getBuckets(@PathVariable Long userId) {
        synchronized (BUCKET_LOCK) {
            List<TaskBucket> list = bucketRepository.findByOwnerIdOrderBySortOrderAscIdAsc(userId);
            if (list.isEmpty()) {
                for (int i = 0; i < DEFAULT_BUCKETS.length; i++) {
                    TaskBucket b = new TaskBucket();
                    b.setOwnerId(userId);
                    b.setName(DEFAULT_BUCKETS[i]);
                    b.setSortOrder(i);
                    bucketRepository.save(b);
                }
                list = bucketRepository.findByOwnerIdOrderBySortOrderAscIdAsc(userId);
            }
            return list;
        }
    }

    @PostMapping("/buckets")
    public ResponseEntity<?> createBucket(@RequestBody Map<String, Object> body) {
        if (body.get("userId") == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Utilizator lipsă!"));
        }
        Long userId = Long.valueOf(body.get("userId").toString());
        String name = body.get("name") != null ? body.get("name").toString().trim() : "";
        String error = validateBucketName(name);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("message", error));
        }

        synchronized (BUCKET_LOCK) {
            List<TaskBucket> existing = bucketRepository.findByOwnerIdOrderBySortOrderAscIdAsc(userId);
            if (existing.stream().anyMatch(b -> b.getName().equalsIgnoreCase(name))) {
                return ResponseEntity.badRequest().body(Map.of("message", "Există deja o coloană cu acest nume!"));
            }
            int nextOrder = existing.stream().mapToInt(TaskBucket::getSortOrder).max().orElse(-1) + 1;

            TaskBucket bucket = new TaskBucket();
            bucket.setOwnerId(userId);
            bucket.setName(name);
            bucket.setSortOrder(nextOrder);
            return ResponseEntity.status(HttpStatus.CREATED).body(bucketRepository.save(bucket));
        }
    }

    @PutMapping("/buckets/{bucketId}")
    public ResponseEntity<?> renameBucket(@PathVariable Long bucketId,
                                          @RequestBody Map<String, Object> body) {
        TaskBucket bucket = bucketRepository.findById(bucketId).orElse(null);
        if (bucket == null) {
            return ResponseEntity.notFound().build();
        }
        if (body.get("userId") == null || !bucket.getOwnerId().equals(Long.valueOf(body.get("userId").toString()))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Nu ai permisiunea de a modifica această coloană!"));
        }

        String name = body.get("name") != null ? body.get("name").toString().trim() : "";
        String error = validateBucketName(name);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("message", error));
        }

        synchronized (BUCKET_LOCK) {
            boolean duplicate = bucketRepository.findByOwnerIdOrderBySortOrderAscIdAsc(bucket.getOwnerId()).stream()
                    .anyMatch(b -> !b.getId().equals(bucketId) && b.getName().equalsIgnoreCase(name));
            if (duplicate) {
                return ResponseEntity.badRequest().body(Map.of("message", "Există deja o coloană cu acest nume!"));
            }
            bucket.setName(name);
            return ResponseEntity.ok(bucketRepository.save(bucket));
        }
    }

    @DeleteMapping("/buckets/{bucketId}")
    public ResponseEntity<?> deleteBucket(@PathVariable Long bucketId, @RequestParam Long userId) {
        TaskBucket bucket = bucketRepository.findById(bucketId).orElse(null);
        if (bucket == null) {
            return ResponseEntity.notFound().build();
        }
        if (!bucket.getOwnerId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Nu ai permisiunea de a șterge această coloană!"));
        }

        synchronized (BUCKET_LOCK) {
            List<TaskBucket> remaining = bucketRepository.findByOwnerIdOrderBySortOrderAscIdAsc(userId).stream()
                    .filter(b -> !b.getId().equals(bucketId))
                    .toList();
            if (remaining.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("message", "Trebuie să rămână cel puțin o coloană!"));
            }

            // Task-urile din coloana ștearsă rămân vizibile: se mută în prima coloană rămasă
            Long fallbackId = remaining.get(0).getId();
            List<Task> orphaned = taskRepository.findByBucketId(bucketId);
            for (Task t : orphaned) {
                t.setBucketId(fallbackId);
            }
            taskRepository.saveAll(orphaned);

            bucketRepository.delete(bucket);
            return ResponseEntity.ok(Map.of("message", "Coloana a fost ștearsă!", "movedTo", fallbackId));
        }
    }

    // --- HELPERS ---
    private String validateBucketName(String name) {
        if (name.isEmpty()) return "Numele coloanei este obligatoriu!";
        if (name.length() > 50) return "Numele coloanei este prea lung (maxim 50 caractere)!";
        return null;
    }

    private LocalDateTime parseDueLine(String raw) {
        String s = raw.trim();
        if (s.length() == 10) {
            s = s + "T23:59:00";
        }
        if (s.endsWith("Z")) {
            s = s.substring(0, s.length() - 1);
        }
        return LocalDateTime.parse(s);
    }

    private void broadcastProjectTask(Task saved) {
        if (saved.getProject() != null && saved.getProject().getId() != null) {
            try {
                messagingTemplate.convertAndSend("/topic/projects/" + saved.getProject().getId() + "/tasks", saved);
            } catch (Exception ignored) {}
        }
    }
}
