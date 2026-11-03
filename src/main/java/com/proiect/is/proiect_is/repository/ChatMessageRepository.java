package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByConversationIdOrderBySentAtAsc(Long conversationId);

    ChatMessage findFirstByConversationIdOrderBySentAtDesc(Long conversationId);

    void deleteByConversationId(Long conversationId);
}
