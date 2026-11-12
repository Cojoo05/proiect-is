package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.KnowledgeNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KnowledgeRepository extends JpaRepository<KnowledgeNote, Long> {

    List<KnowledgeNote> findAllByOrderByIsPinnedDescCreatedAtDesc();

    List<KnowledgeNote> findByCreatorIdOrderByCreatedAtDesc(Long creatorId);

    List<KnowledgeNote> findByCategoryIgnoreCaseOrderByIsPinnedDescCreatedAtDesc(String category);
}
