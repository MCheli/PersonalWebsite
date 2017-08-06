package com.mcheli.personalwebsite;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import java.util.Properties;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.PasswordAuthentication;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

@Controller
@RequestMapping("/contact")
public class ContactMessageController {

    @Value("${EMAIL_USERNAME}")
    private String username;

    @Value("${EMAIL_PASSWORD}")
    private String password;

    @Autowired
    private ContactMessageRepository contactMessageRepository;

    @RequestMapping(method = RequestMethod.GET)
    public @ResponseBody ResponseEntity<Iterable> listMessages(){
        Iterable<ContactMessage> messages = contactMessageRepository.findAll();
        return new ResponseEntity<Iterable>(messages, HttpStatus.OK);
    }

    @RequestMapping(method = RequestMethod.POST)
    public @ResponseBody ResponseEntity<ContactMessage> sendMessage(@RequestBody ContactMessage message){
        //Save message to the database
        contactMessageRepository.save(message);
        sendEmail(message);

        return new ResponseEntity<ContactMessage>(message, HttpStatus.OK);

    }

    private void sendEmail(ContactMessage message){
        //TODO: Move this to environment variables
        //MailJet information

        Properties props = new Properties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.host", "in-v3.mailjet.com");
        props.put("mail.smtp.port", "587");

        Session session = Session.getInstance(props,
                new javax.mail.Authenticator() {
                    protected PasswordAuthentication getPasswordAuthentication() {
                        return new PasswordAuthentication(username, password);
                    }
                });

        try {
            Message email = new MimeMessage(session);
            email.setFrom(new InternetAddress("mpcheli7@gmail.com"));
            email.setRecipients(Message.RecipientType.TO,
                    InternetAddress.parse("mpcheli7@gmail.com"));
            email.setSubject("Website Email from " + message.getName());
            email.setText(message.getMessage() + "\n\nMailed from: " + message.getEmail());

            Transport.send(email);
        } catch (MessagingException e) {
            throw new RuntimeException(e);
        }
    }

}