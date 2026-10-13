package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.Note;
import com.proiect.is.proiect_is.repository.NoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/notes")
@CrossOrigin(origins = "http://localhost:5173")
public class NoteController {

    private final NoteRepository noteRepository;

    @Autowired
    public NoteController(NoteRepository noteRepository) {
        this.noteRepository = noteRepository;
    }
    @GetMapping("/creator/{creatorId}")
    public ResponseEntity<List<Note>> getNotesByCreator(@PathVariable Long creatorId) {
        Sort sort = Sort.by(Sort.Direction.DESC, "isPinned")
                .and(Sort.by(Sort.Direction.DESC, "lastModificationDate"));
        List<Note> notes = noteRepository.findByCreatorId(creatorId, sort);
        return ResponseEntity.ok(notes);
    }
    @PostMapping
    public ResponseEntity<Note> createNote(@RequestBody Note note) {
        LocalDateTime now = LocalDateTime.now();
        if (note.getCreationDate() == null) {
            note.setCreationDate(now);
        }
        note.setLastModificationDate(now);
        if (note.getPinned() == null) {
            note.setPinned(false);
        }

        Note savedNote = noteRepository.save(note);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedNote);
    }
    @PutMapping("/{id}")
    public ResponseEntity<Note> updateNote(@PathVariable Long id, @RequestBody Note noteDetails) {
        return noteRepository.findById(id)
                .map(existingNote -> {
                    if (noteDetails.getTitle() != null) {
                        existingNote.setTitle(noteDetails.getTitle());
                    }
                    if (noteDetails.getText() != null) {
                        existingNote.setText(noteDetails.getText());
                    }
                    if (noteDetails.getPinned() != null) {
                        existingNote.setPinned(noteDetails.getPinned());
                    }
                    existingNote.setLastModificationDate(LocalDateTime.now());

                    Note updatedNote = noteRepository.save(existingNote);
                    return ResponseEntity.ok(updatedNote);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable Long id) {
        return noteRepository.findById(id)
                .map(existingNote -> {
                    noteRepository.delete(existingNote);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}