package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.ProjectLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectLinkRepository extends JpaRepository<ProjectLink, Long> {
    List<ProjectLink> findByProjectIdOrderByAddedAtDesc(Long projectId);
}
