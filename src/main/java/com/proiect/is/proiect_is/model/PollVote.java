package com.proiect.is.proiect_is.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "poll_votes", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"voter_id", "poll_id"})
})
public class PollVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_id", nullable = false)
    private PollOption option;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "voter_id", nullable = false)
    private User voter;

    @Column(name = "poll_id", nullable = false)
    private Long pollId;

    public PollVote() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public PollOption getOption() { return option; }
    public void setOption(PollOption option) { this.option = option; }
    public User getVoter() { return voter; }
    public void setVoter(User voter) { this.voter = voter; }
    public Long getPollId() { return pollId; }
    public void setPollId(Long pollId) { this.pollId = pollId; }
}
