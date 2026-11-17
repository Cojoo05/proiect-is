package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.TaskBucket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskBucketRepository extends JpaRepository<TaskBucket, Long> {
    List<TaskBucket> findByOwnerIdOrderBySortOrderAscIdAsc(Long ownerId);
}
