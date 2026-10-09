package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.List;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @PostMapping
    public User createUser(@RequestBody User user) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        String hash = encoder.encode(user.getPassword());
        user.setPassword(hash);
        return userRepository.save(user);
    }

    @PutMapping("/{id}")
    public User updateUser(@PathVariable Long id, @RequestBody User userDetails) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User-ul nu a fost găsit cu id: " + id));

        user.setUsername(userDetails.getUsername());
        user.setEmail(userDetails.getEmail());
        user.setRole(userDetails.getRole());

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        String hash = encoder.encode(userDetails.getPassword());
        user.setPassword(hash);

        return userRepository.save(user);
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Long id) {
        userRepository.deleteById(id);
    }
}
