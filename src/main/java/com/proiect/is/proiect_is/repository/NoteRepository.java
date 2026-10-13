package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.Note;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findByCreatorId(Long creatorId);
    List<Note> findByCreatorId(Long creatorId, Sort sort);
}