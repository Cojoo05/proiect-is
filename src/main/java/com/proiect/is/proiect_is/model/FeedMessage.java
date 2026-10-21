package com.proiect.is.proiect_is.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "feed_messages")
public class FeedMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "channel_id", nullable = false)
    private FeedChannel channel;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    private LocalDateTime sentAt;

    // For polls embedded in feed: optional reference
    @Column
    private Long pollId;

    // Type: TEXT or POLL
    @Column(nullable = false)
    private String type = "TEXT";

    public FeedMessage() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public FeedChannel getChannel() { return channel; }
    public void setChannel(FeedChannel channel) { this.channel = channel; }
    public User getSender() { return sender; }
    public void setSender(User sender) { this.sender = sender; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
    public Long getPollId() { return pollId; }
    public void setPollId(Long pollId) { this.pollId = pollId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}
