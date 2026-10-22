package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.FeedChannel;
import com.proiect.is.proiect_is.model.FeedMessage;
import com.proiect.is.proiect_is.model.Project;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.FeedChannelRepository;
import com.proiect.is.proiect_is.repository.FeedMessageRepository;
import com.proiect.is.proiect_is.repository.ProjectRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "http://localhost:5173")
public class FeedController {

    private final FeedChannelRepository channelRepo;
    private final FeedMessageRepository messageRepo;
    private final ProjectRepository projectRepo;
    private final UserRepository userRepo;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public FeedController(FeedChannelRepository channelRepo,
                          FeedMessageRepository messageRepo,
                          ProjectRepository projectRepo,
                          UserRepository userRepo,
                          SimpMessagingTemplate messagingTemplate) {
        this.channelRepo = channelRepo;
        this.messageRepo = messageRepo;
        this.projectRepo = projectRepo;
        this.userRepo = userRepo;
        this.messagingTemplate = messagingTemplate;
    }

    // --- CHANNELS ---

    @GetMapping("/{projectId}/feed/channels")
    public ResponseEntity<List<FeedChannel>> getChannels(@PathVariable Long projectId) {
        List<FeedChannel> channels = channelRepo.findByProjectId(projectId);
        if (channels.isEmpty()) {
            Project project = projectRepo.findById(projectId).orElse(null);
            if (project != null) {
                FeedChannel general = new FeedChannel();
                general.setProject(project);
                general.setName("general");
                general.setCreatedAt(LocalDateTime.now());
                channels = new ArrayList<>();
                channels.add(channelRepo.save(general));
            }
        }
        return ResponseEntity.ok(channels);
    }

    @PostMapping("/{projectId}/feed/channels")
    public ResponseEntity<FeedChannel> createChannel(@PathVariable Long projectId,
                                                      @RequestBody Map<String, String> body) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        FeedChannel channel = new FeedChannel();
        channel.setProject(project);
        channel.setName(body.get("name"));
        channel.setCreatedAt(LocalDateTime.now());
        FeedChannel saved = channelRepo.save(channel);

        // Notify all subscribers
        try {
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/channels", saved);
        } catch (Exception e) {
            // ignore
        }
        return ResponseEntity.ok(saved);
    }

    // --- MESSAGES ---

    @GetMapping("/{projectId}/feed")
    public ResponseEntity<List<FeedMessage>> getMessages(@PathVariable Long projectId,
                                                          @RequestParam Long channelId) {
        return ResponseEntity.ok(messageRepo.findByChannelIdOrderBySentAtAsc(channelId));
    }

    @PostMapping("/{projectId}/feed")
    public ResponseEntity<FeedMessage> sendMessage(@PathVariable Long projectId,
                                                    @RequestBody Map<String, Object> body) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Long channelId = Long.valueOf(body.get("channelId").toString());
        Long senderId = Long.valueOf(body.get("senderId").toString());

        FeedChannel channel = channelRepo.findById(channelId)
                .orElseThrow(() -> new RuntimeException("Channel not found"));
        User sender = userRepo.findById(senderId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        FeedMessage message = new FeedMessage();
        message.setProject(project);
        message.setChannel(channel);
        message.setSender(sender);
        message.setContent(body.get("content").toString());
        message.setSentAt(LocalDateTime.now());
        message.setType(body.containsKey("type") ? body.get("type").toString() : "TEXT");
        if (body.containsKey("pollId") && body.get("pollId") != null) {
            message.setPollId(Long.valueOf(body.get("pollId").toString()));
        }

        FeedMessage saved = messageRepo.save(message);

        // Push to WebSocket subscribers
        try {
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/feed/" + channelId, saved);
        } catch (Exception e) {
            // ignore
        }
        return ResponseEntity.ok(saved);
    }
}
