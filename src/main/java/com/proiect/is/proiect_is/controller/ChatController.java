package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.ChatMessage;
import com.proiect.is.proiect_is.model.Conversation;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.ChatMessageRepository;
import com.proiect.is.proiect_is.repository.ConversationRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app"})
public class ChatController {

    private final ConversationRepository conversationRepo;
    private final ChatMessageRepository messageRepo;
    private final UserRepository userRepo;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public ChatController(ConversationRepository conversationRepo,
                          ChatMessageRepository messageRepo,
                          UserRepository userRepo,
                          SimpMessagingTemplate messagingTemplate) {
        this.conversationRepo = conversationRepo;
        this.messageRepo = messageRepo;
        this.userRepo = userRepo;
        this.messagingTemplate = messagingTemplate;
    }

    // --- GET USER CONVERSATIONS WITH PREVIEWS ---
    @GetMapping("/conversations")
    public ResponseEntity<List<Map<String, Object>>> getUserConversations(@RequestParam Long userId) {
        List<Conversation> conversations = conversationRepo.findUserConversations(userId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (Conversation c : conversations) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", c.getId());
            item.put("type", c.getType());
            item.put("name", c.getName());
            item.put("createdAt", c.getCreatedAt());
            item.put("updatedAt", c.getUpdatedAt());
            item.put("createdBy", c.getCreatedBy());
            item.put("participants", c.getParticipants());

            ChatMessage lastMsg = messageRepo.findFirstByConversationIdOrderBySentAtDesc(c.getId());
            if (lastMsg != null) {
                Map<String, Object> lastMsgMap = new HashMap<>();
                lastMsgMap.put("id", lastMsg.getId());
                lastMsgMap.put("content", lastMsg.getContent());
                lastMsgMap.put("sentAt", lastMsg.getSentAt());
                lastMsgMap.put("senderId", lastMsg.getSender() != null ? lastMsg.getSender().getId() : null);
                lastMsgMap.put("senderName", lastMsg.getSender() != null ? lastMsg.getSender().getUsername() : null);
                item.put("lastMessage", lastMsgMap);
            } else {
                item.put("lastMessage", null);
            }

            result.add(item);
        }

        return ResponseEntity.ok(result);
    }

    // --- GET CONVERSATION MESSAGES ---
    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<List<ChatMessage>> getMessages(@PathVariable Long conversationId,
                                                          @RequestParam(required = false) Long currentUserId) {
        List<ChatMessage> messages = messageRepo.findByConversationIdOrderBySentAtAsc(conversationId);

        // Mark unread messages from others as read
        if (currentUserId != null) {
            for (ChatMessage m : messages) {
                if (!m.isRead() && (m.getSender() == null || !m.getSender().getId().equals(currentUserId))) {
                    m.setRead(true);
                    messageRepo.save(m);
                }
            }
        }

        return ResponseEntity.ok(messages);
    }

    // --- START OR GET DIRECT CONVERSATION ---
    @PostMapping("/direct")
    public ResponseEntity<Conversation> getOrCreateDirectConversation(@RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        Long otherUserId = body.get("otherUserId");

        if (userId.equals(otherUserId)) {
            return ResponseEntity.badRequest().build();
        }

        User u1 = userRepo.findById(userId).orElseThrow(() -> new RuntimeException("User not found: " + userId));
        User u2 = userRepo.findById(otherUserId).orElseThrow(() -> new RuntimeException("User not found: " + otherUserId));

        List<Conversation> existing = conversationRepo.findDirectConversationBetween(userId, otherUserId);
        if (!existing.isEmpty()) {
            return ResponseEntity.ok(existing.get(0));
        }

        Conversation conv = new Conversation();
        conv.setType("DIRECT");
        conv.setCreatedAt(LocalDateTime.now());
        conv.setUpdatedAt(LocalDateTime.now());
        conv.setCreatedBy(u1);
        conv.getParticipants().add(u1);
        conv.getParticipants().add(u2);

        Conversation saved = conversationRepo.save(conv);
        return ResponseEntity.ok(saved);
    }

    // --- CREATE GROUP CONVERSATION ---
    @PostMapping("/group")
    public ResponseEntity<Conversation> createGroupConversation(@RequestBody Map<String, Object> body) {
        String name = body.get("name").toString();
        Long creatorId = Long.valueOf(body.get("creatorId").toString());

        @SuppressWarnings("unchecked")
        List<Integer> participantIds = (List<Integer>) body.get("participantIds");

        User creator = userRepo.findById(creatorId)
                .orElseThrow(() -> new RuntimeException("Creator not found"));

        Conversation conv = new Conversation();
        conv.setType("GROUP");
        conv.setName(name);
        conv.setCreatedBy(creator);
        conv.setCreatedAt(LocalDateTime.now());
        conv.setUpdatedAt(LocalDateTime.now());

        Set<User> participants = new HashSet<>();
        participants.add(creator);

        if (participantIds != null) {
            for (Integer pId : participantIds) {
                userRepo.findById(pId.longValue()).ifPresent(participants::add);
            }
        }
        conv.setParticipants(participants);
        Conversation saved = conversationRepo.save(conv);

        // Notify participants via WebSocket
        for (User p : saved.getParticipants()) {
            try {
                messagingTemplate.convertAndSend("/topic/chat/users/" + p.getId() + "/notifications", saved);
            } catch (Exception ignored) {}
        }

        return ResponseEntity.ok(saved);
    }

    // --- SEND MESSAGE ---
    @PostMapping("/messages")
    public ResponseEntity<ChatMessage> sendMessage(@RequestBody Map<String, Object> body) {
        Long conversationId = Long.valueOf(body.get("conversationId").toString());
        Long senderId = Long.valueOf(body.get("senderId").toString());
        String content = body.get("content").toString().trim();

        if (content.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Conversation conversation = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));
        User sender = userRepo.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));

        ChatMessage message = new ChatMessage();
        message.setConversation(conversation);
        message.setSender(sender);
        message.setContent(content);
        message.setSentAt(LocalDateTime.now());
        message.setRead(false);

        ChatMessage saved = messageRepo.save(message);

        // Update conversation last active timestamp
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepo.save(conversation);

        // Broadcast to conversation subscribers
        try {
            messagingTemplate.convertAndSend("/topic/chat/conversations/" + conversationId, saved);

            // Notify all participants so their conversation list updates live
            for (User p : conversation.getParticipants()) {
                messagingTemplate.convertAndSend("/topic/chat/users/" + p.getId() + "/notifications", saved);
            }
        } catch (Exception e) {
            // WS send fails gracefully
        }

        return ResponseEntity.ok(saved);
    }

    // --- ADD PARTICIPANT TO GROUP ---
    @PostMapping("/conversations/{conversationId}/participants")
    public ResponseEntity<Conversation> addParticipantToGroup(@PathVariable Long conversationId,
                                                              @RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        Conversation conversation = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!"GROUP".equals(conversation.getType())) {
            return ResponseEntity.badRequest().build();
        }

        User userToAdd = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        conversation.getParticipants().add(userToAdd);
        conversation.setUpdatedAt(LocalDateTime.now());
        Conversation saved = conversationRepo.save(conversation);

        // Notify new user and existing members
        try {
            messagingTemplate.convertAndSend("/topic/chat/users/" + userId + "/notifications", saved);
            messagingTemplate.convertAndSend("/topic/chat/conversations/" + conversationId + "/members", saved);
        } catch (Exception ignored) {}

        return ResponseEntity.ok(saved);
    }

    // --- REMOVE / LEAVE GROUP ---
    @DeleteMapping("/conversations/{conversationId}/participants/{userId}")
    public ResponseEntity<Void> removeParticipantFromGroup(@PathVariable Long conversationId,
                                                            @PathVariable Long userId) {
        Conversation conversation = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!"GROUP".equals(conversation.getType())) {
            return ResponseEntity.badRequest().build();
        }

        conversation.getParticipants().removeIf(u -> u.getId().equals(userId));
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepo.save(conversation);

        return ResponseEntity.ok().build();
    }

    // --- DELETE CONVERSATION ---
    @Transactional
    @DeleteMapping("/conversations/{conversationId}")
    public ResponseEntity<Void> deleteConversation(@PathVariable Long conversationId) {
        Conversation conversation = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        messageRepo.deleteByConversationId(conversationId);
        conversationRepo.delete(conversation);

        return ResponseEntity.ok().build();
    }
}
