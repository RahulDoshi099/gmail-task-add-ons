const API_BASE_URL = 'https://simple-gmail-tasks.onrender.com/api';

function displayMessageDetails(e) {
  const details = getMessageDetails(e);

  if (!details) {
    return CardService.newCardBuilder()
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('Unable to retrieve message details. Please open an email and try again.')))
      .build();
  }

  const tasks = getTasksByMessageId(details.messageId);

  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection();

  // Display email details
  section.addWidget(CardService.newTextParagraph().setText('From: ' + details.from));
  section.addWidget(CardService.newTextParagraph().setText('To: ' + details.to));
  section.addWidget(CardService.newTextParagraph().setText('Subject: ' + details.subject));
  
  // Process and display HTML body content (limited HTML tags allowed)
  const bodyText = extractTextFromHTML(details.body);
  section.addWidget(CardService.newTextParagraph().setText(bodyText));

  // Add a note input field
  section.addWidget(CardService.newTextInput().setFieldName('note').setTitle('Add a note'));
  section.addWidget(CardService.newTextButton().setText('Save to Task Inbox').setOnClickAction(CardService.newAction().setFunctionName('saveToTaskInbox')));

  card.addSection(section);

  // Display tasks if available
  if (tasks.length > 0) {
    tasks.forEach((task) => {
      card.addSection(
        CardService.newCardSection()
          .addWidget(CardService.newKeyValue()
            .setTopLabel(task.title)
            .setContent(task.detail)
            .setBottomLabel(new Date(task.createdAt).toLocaleString())
          )
          .addWidget(CardService.newTextButton()
            .setText("Edit Task")
            .setOnClickAction(CardService.newAction().setFunctionName("editTaskCard").setParameters({ taskId: task._id, threadId: task.threadId }))
          )
          .addWidget(CardService.newTextButton()
            .setText("Delete Task")
            .setOnClickAction(CardService.newAction().setFunctionName("confirmDeleteTask").setParameters({ taskId: task._id }))
          )
      );
    });
  }

  return card.build();
}

// Utility function to extract text from HTML content
function extractTextFromHTML(htmlContent) {
  // Remove HTML tags and decode HTML entities
  const tempElement = HtmlService.createHtmlOutput(htmlContent).getContent();
  const plainText = tempElement.replace(/<[^>]+>/g, '');
  return plainText;
}

function getTasksByMessageId(messageId) {
  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/tasks/thread/${messageId}`, {
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());
    if (response.getResponseCode() === 200 && result.success) {
      return result.tasks;
    } else {
      console.error('Error fetching tasks by message ID:', result.error || result.message || 'Unknown error');
      return [];
    }
  } catch (error) {
    console.error('Error in getTasksByMessageId:', error);
    return [];
  }
}

function getMessageDetails(e) {
  let messageId;

  if (e && e.gmail && e.gmail.messageId) {
    messageId = e.gmail.messageId;
  } else {
    const threads = GmailApp.getInboxThreads(0, 1);
    if (threads && threads.length > 0) {
      const messages = threads[0].getMessages();
      if (messages && messages.length > 0) {
        messageId = messages[0].getId();
      }
    }
  }

  if (!messageId) {
    console.error('No message ID found');
    return null;
  }

  const message = GmailApp.getMessageById(messageId);

  if (!message) {
    console.error('No message found with ID: ' + messageId);
    return null;
  }

  return {
    from: message.getFrom(),
    to: message.getTo(),
    subject: message.getSubject(),
    body: message.getPlainBody(),
    messageId: messageId
  };
}
