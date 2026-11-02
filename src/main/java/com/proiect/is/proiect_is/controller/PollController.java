package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.*;
import com.proiect.is.proiect_is.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app"})
public class PollController {

    private final PollRepository pollRepo;
    private final PollOptionRepository pollOptionRepo;
    private final PollVoteRepository pollVoteRepo;
    private final ProjectRepository projectRepo;
    private final UserRepository userRepo;
    private final FeedMessageRepository feedMessageRepo;
    private final FeedChannelRepository feedChannelRepo;
    private final SimpMessagingTemplate messagingTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    public PollController(PollRepository pollRepo,
                          PollOptionRepository pollOptionRepo,
                          PollVoteRepository pollVoteRepo,
                          ProjectRepository projectRepo,
                          UserRepository userRepo,
                          FeedMessageRepository feedMessageRepo,
                          FeedChannelRepository feedChannelRepo,
                          SimpMessagingTemplate messagingTemplate) {
        this.pollRepo = pollRepo;
        this.pollOptionRepo = pollOptionRepo;
        this.pollVoteRepo = pollVoteRepo;
        this.projectRepo = projectRepo;
        this.userRepo = userRepo;
        this.feedMessageRepo = feedMessageRepo;
        this.feedChannelRepo = feedChannelRepo;
        this.messagingTemplate = messagingTemplate;
    }

    @GetMapping("/{projectId}/polls")
    public ResponseEntity<List<Poll>> getPolls(@PathVariable Long projectId) {
        return ResponseEntity.ok(pollRepo.findByProjectIdOrderByCreatedAtDesc(projectId));
    }

    @GetMapping("/{projectId}/polls/{pollId}")
    public ResponseEntity<Poll> getPollById(@PathVariable Long projectId, @PathVariable Long pollId) {
        return pollRepo.findById(pollId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @PostMapping("/{projectId}/polls")
    public ResponseEntity<Poll> createPoll(@PathVariable Long projectId,
                                            @RequestBody Map<String, Object> body) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Long creatorId = Long.valueOf(body.get("createdById").toString());
        User creator = userRepo.findById(creatorId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Poll poll = new Poll();
        poll.setProject(project);
        poll.setCreatedBy(creator);
        poll.setQuestion(body.get("question").toString());
        poll.setCreatedAt(LocalDateTime.now());
        Poll savedPoll = pollRepo.save(poll);

        @SuppressWarnings("unchecked")
        List<String> optionTexts = (List<String>) body.get("options");
        List<PollOption> savedOptions = new ArrayList<>();
        if (optionTexts != null) {
            for (String text : optionTexts) {
                if (text != null && !text.trim().isEmpty()) {
                    PollOption opt = new PollOption();
                    opt.setPoll(savedPoll);
                    opt.setText(text.trim());
                    opt.setVotes(new ArrayList<>());
                    savedOptions.add(pollOptionRepo.save(opt));
                }
            }
        }
        savedPoll.setOptions(savedOptions);

        // Auto-post in general channel feed (ensure channel exists)
        List<FeedChannel> channels = feedChannelRepo.findByProjectId(projectId);
        FeedChannel generalChannel;
        if (channels.isEmpty()) {
            generalChannel = new FeedChannel();
            generalChannel.setProject(project);
            generalChannel.setName("general");
            generalChannel.setCreatedAt(LocalDateTime.now());
            generalChannel = feedChannelRepo.save(generalChannel);
        } else {
            generalChannel = channels.get(0);
        }

        FeedMessage pollMsg = new FeedMessage();
        pollMsg.setProject(project);
        pollMsg.setChannel(generalChannel);
        pollMsg.setSender(creator);
        pollMsg.setContent("📊 " + savedPoll.getQuestion());
        pollMsg.setType("POLL");
        pollMsg.setPollId(savedPoll.getId());
        pollMsg.setSentAt(LocalDateTime.now());
        FeedMessage savedMsg = feedMessageRepo.save(pollMsg);

        try {
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/feed/" + generalChannel.getId(), savedMsg);
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/polls", savedPoll);
        } catch (Exception e) {
            // WS send fails gracefully if client disconnected
        }

        return ResponseEntity.ok(savedPoll);
    }

    @Transactional
    @PostMapping("/{projectId}/polls/{pollId}/vote")
    public ResponseEntity<Poll> vote(@PathVariable Long projectId,
                                      @PathVariable Long pollId,
                                      @RequestBody Map<String, Object> body) {
        Long optionId = Long.valueOf(body.get("optionId").toString());
        Long voterId = Long.valueOf(body.get("voterId").toString());

        PollOption option = pollOptionRepo.findById(optionId)
                .orElseThrow(() -> new RuntimeException("Option not found"));
        User voter = userRepo.findById(voterId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Optional<PollVote> existingVote = pollVoteRepo.findByVoterIdAndPollId(voterId, pollId);
        if (existingVote.isPresent()) {
            PollVote current = existingVote.get();
            if (current.getOption().getId().equals(optionId)) {
                // Already voted for this same option - keep it
            } else {
                // Change vote to new option
                current.setOption(option);
                pollVoteRepo.save(current);
            }
        } else {
            PollVote vote = new PollVote();
            vote.setOption(option);
            vote.setVoter(voter);
            vote.setPollId(pollId);
            pollVoteRepo.save(vote);
        }

        entityManager.flush();
        entityManager.clear();

        Poll updated = pollRepo.findById(pollId).orElseThrow(() -> new RuntimeException("Poll not found"));

        try {
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/polls", updated);
        } catch (Exception e) {
            // WS send fails gracefully
        }

        return ResponseEntity.ok(updated);
    }
}
