package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.KnowledgeCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KnowledgeCategoryRepository extends JpaRepository<KnowledgeCategory, Long> {

    List<KnowledgeCategory> findAllByOrderByNameAsc();

    Optional<KnowledgeCategory> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
