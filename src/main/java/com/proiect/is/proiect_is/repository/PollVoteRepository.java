package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.PollVote;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PollVoteRepository extends JpaRepository<PollVote, Long> {
    Optional<PollVote> findByVoterIdAndPollId(Long voterId, Long pollId);
    boolean existsByVoterIdAndPollId(Long voterId, Long pollId);
    java.util.List<PollVote> findByPollId(Long pollId);
}
