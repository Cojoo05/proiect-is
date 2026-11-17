package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.ProjectRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectRoleRepository extends JpaRepository<ProjectRole, Long> {
    List<ProjectRole> findByProjectIdOrderByIdAsc(Long projectId);
}
