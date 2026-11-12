package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByAssigneeId(Long assigneeId);
    List<Task> findByCreatorId(Long creatorId);

    @Query("SELECT t FROM Task t WHERE t.project.id = :projectId ORDER BY t.id DESC")
    List<Task> findByProjectId(@Param("projectId") Long projectId);

    List<Task> findByBucketId(Long bucketId);
}
