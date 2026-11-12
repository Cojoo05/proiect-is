package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByOwnerId(Long ownerId);

    @Query("SELECT DISTINCT p FROM Project p " +
            "LEFT JOIN ProjectMember pm ON pm.project.id = p.id " +
            "WHERE p.owner.id = :userId OR pm.user.id = :userId " +
            "ORDER BY p.createdAt DESC")
    List<Project> findAccessibleProjects(@Param("userId") Long userId);
}
