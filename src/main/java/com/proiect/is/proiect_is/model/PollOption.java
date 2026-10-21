package com.proiect.is.proiect_is.model;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "poll_options")
public class PollOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "poll_id", nullable = false)
    private Poll poll;

    @Column(nullable = false)
    private String text;

    @OneToMany(mappedBy = "option", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<PollVote> votes;

    public PollOption() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Poll getPoll() { return poll; }
    public void setPoll(Poll poll) { this.poll = poll; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public List<PollVote> getVotes() { return votes; }
    public void setVotes(List<PollVote> votes) { this.votes = votes; }
}
