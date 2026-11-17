package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.KnowledgeFolder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KnowledgeFolderRepository extends JpaRepository<KnowledgeFolder, Long> {

    List<KnowledgeFolder> findByParentIdOrderByNameAsc(Long parentId);

    List<KnowledgeFolder> findByParentIdIsNullOrderByNameAsc();

    List<KnowledgeFolder> findAllByOrderByNameAsc();

    List<KnowledgeFolder> findByParentId(Long parentId);
}
