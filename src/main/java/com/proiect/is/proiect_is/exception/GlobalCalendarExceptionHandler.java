package com.proiect.is.proiect_is.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Handler global de excepții pentru modulul Calendar și Notificări.
 *
 * Interceptează erorile de validare JSR-380, erorile de resursă negăsită
 * și excepțiile de business, transformându-le în răspunsuri JSON structurate
 * conform standardului RFC 7807 (Problem Details for HTTP APIs).
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@RestControllerAdvice(basePackages = "com.proiect.is.proiect_is.controller")
public class GlobalCalendarExceptionHandler {

    /**
     * Tratează erorile când un eveniment nu este găsit.
     */
    @ExceptionHandler(CalendarResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(CalendarResourceNotFoundException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", HttpStatus.NOT_FOUND.value());
        body.put("error", "Not Found");
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    /**
     * Tratează erorile de validare de business din calendar.
     */
    @ExceptionHandler(CalendarValidationException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(CalendarValidationException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("error", "Validation Failed");
        body.put("message", ex.getMessage());
        if (ex.getValidationErrors() != null) {
            body.put("details", ex.getValidationErrors());
        }
        return ResponseEntity.badRequest().body(body);
    }

    /**
     * Tratează erorile generate de adnotările @Valid pe DTO-uri.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("error", "Bad Request");

        List<String> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.toList());

        body.put("message", "Datele transmise nu respectă cerințele de validare.");
        body.put("errors", errors);

        return ResponseEntity.badRequest().body(body);
    }
}
