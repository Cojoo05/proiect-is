package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.Poll;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PollRepository extends JpaRepository<Poll, Long> {
    List<Poll> findByProjectIdOrderByCreatedAtDesc(Long projectId);
}
