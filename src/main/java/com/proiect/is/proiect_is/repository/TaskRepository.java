package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.Task;
import com.proiect.is.proiect_is.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByAssigneeId(Long assigneeId);
    List<Task> findByCreatorId(Long creatorId);
}
