package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.UserRepository;
import com.proiect.is.proiect_is.service.SystemRoleService;
import com.proiect.is.proiect_is.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.List;
import java.util.Map;

@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app"})
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SystemRoleService systemRoleService;

    private void enrichUserRole(User user) {
        if (user == null) return;
        boolean hasAdmin = systemRoleService.hasAdminAccess(user.getRole());
        user.setHasAdminAccess(hasAdmin);
    }

    @GetMapping
    public List<User> getAllUsers() {
        List<User> users = userRepository.findAll();
        users.forEach(this::enrichUserRole);
        return users;
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody User user) {
        if (user.getRole() == null || user.getRole().trim().isEmpty()) {
            user.setRole("User");
        }

        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
            user.setPassword(encoder.encode(user.getPassword()));
        }

        User saved = userRepository.save(user);
        enrichUserRole(saved);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody User userDetails) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User-ul nu a fost găsit cu id: " + id));

        // Safety check if changing this user's role from full access to non-full access
        boolean currentlyHasAdmin = systemRoleService.hasAdminAccess(user.getRole());
        boolean targetHasAdmin = systemRoleService.hasAdminAccess(userDetails.getRole());

        if (currentlyHasAdmin && !targetHasAdmin) {
            // Count how many users currently have full access
            long totalFullAccessUsers = userRepository.findAll().stream()
                    .filter(u -> systemRoleService.hasAdminAccess(u.getRole()))
                    .count();

            if (totalFullAccessUsers <= 1) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Nu poți retrage rolul de administrator al acestui utilizator! Este ultimul utilizator cu drepturi depline din sistem."
                ));
            }
        }

        user.setUsername(userDetails.getUsername());
        user.setEmail(userDetails.getEmail());
        if (userDetails.getRole() != null && !userDetails.getRole().trim().isEmpty()) {
            user.setRole(userDetails.getRole().trim());
        }

        // Only update password if a new password is provided
        if (userDetails.getPassword() != null && !userDetails.getPassword().trim().isEmpty()) {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
            user.setPassword(encoder.encode(userDetails.getPassword()));
        }

        User saved = userRepository.save(user);
        enrichUserRole(saved);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User-ul nu a fost găsit cu id: " + id));

        if (systemRoleService.hasAdminAccess(user.getRole())) {
            long totalFullAccessUsers = userRepository.findAll().stream()
                    .filter(u -> systemRoleService.hasAdminAccess(u.getRole()))
                    .count();

            if (totalFullAccessUsers <= 1) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Nu poți șterge acest utilizator! Este ultimul utilizator cu drepturi depline din sistem."
                ));
            }
        }

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Utilizator șters cu succes!"));
    }

    @PostMapping("/login")
    public ResponseEntity<String> loginUser(@RequestBody User loginData) {
        boolean isValid = userService.checkLogin(loginData.getUsername(), loginData.getPassword());

        if (isValid) {
            return ResponseEntity.ok("Login successful");
        } else {
            return ResponseEntity.status(401).body("Invalid credentials");
        }
    }
}
