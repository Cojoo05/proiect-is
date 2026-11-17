package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.SystemRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SystemRoleRepository extends JpaRepository<SystemRole, Long> {
    Optional<SystemRole> findByNameIgnoreCase(String name);
    List<SystemRole> findByHasFullAccessTrue();
    Optional<SystemRole> findByIsDefaultTrue();
}
