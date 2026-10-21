package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.*;
import com.proiect.is.proiect_is.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "http://localhost:5173")
public class PollController {

    private final PollRepository pollRepo;
    private final PollOptionRepository pollOptionRepo;
    private final PollVoteRepository pollVoteRepo;
    private final ProjectRepository projectRepo;
    private final UserRepository userRepo;
    private final FeedMessageRepository feedMessageRepo;
    private final FeedChannelRepository feedChannelRepo;
    private final SimpMessagingTemplate messagingTemplate;

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
        for (String text : optionTexts) {
            PollOption opt = new PollOption();
            opt.setPoll(savedPoll);
            opt.setText(text);
            pollOptionRepo.save(opt);
        }

        Poll fullPoll = pollRepo.findById(savedPoll.getId()).orElse(savedPoll);

        // Auto-post in general channel feed
        List<FeedChannel> channels = feedChannelRepo.findByProjectId(projectId);
        if (!channels.isEmpty()) {
            FeedChannel generalChannel = channels.get(0);
            FeedMessage pollMsg = new FeedMessage();
            pollMsg.setProject(project);
            pollMsg.setChannel(generalChannel);
            pollMsg.setSender(creator);
            pollMsg.setContent("📊 " + poll.getQuestion());
            pollMsg.setType("POLL");
            pollMsg.setPollId(savedPoll.getId());
            pollMsg.setSentAt(LocalDateTime.now());
            FeedMessage savedMsg = feedMessageRepo.save(pollMsg);
            messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/feed/" + generalChannel.getId(), savedMsg);
        }

        messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/polls", fullPoll);
        return ResponseEntity.ok(fullPoll);
    }

    @PostMapping("/{projectId}/polls/{pollId}/vote")
    public ResponseEntity<Poll> vote(@PathVariable Long projectId,
                                      @PathVariable Long pollId,
                                      @RequestBody Map<String, Object> body) {
        Long optionId = Long.valueOf(body.get("optionId").toString());
        Long voterId = Long.valueOf(body.get("voterId").toString());

        if (pollVoteRepo.existsByVoterIdAndPollId(voterId, pollId)) {
            return ResponseEntity.badRequest().build();
        }

        PollOption option = pollOptionRepo.findById(optionId)
                .orElseThrow(() -> new RuntimeException("Option not found"));
        User voter = userRepo.findById(voterId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PollVote vote = new PollVote();
        vote.setOption(option);
        vote.setVoter(voter);
        vote.setPollId(pollId);
        pollVoteRepo.save(vote);

        Poll updated = pollRepo.findById(pollId).orElseThrow();
        messagingTemplate.convertAndSend("/topic/projects/" + projectId + "/polls", updated);
        return ResponseEntity.ok(updated);
    }
}
