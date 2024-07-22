const API_BASE_URL = 'https://simple-gmail-tasks.onrender.com/api';

function onHomepage(e) {
  return createHomeCard();
}

function createHomeCard() {
  const tasks = getTasks();
  const card = CardService.newCardBuilder();

  card.setHeader(CardService.newCardHeader().setTitle("Task Inbox"));

  if (tasks.length === 0) {
    card.addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText("No tasks created yet."))
    );
  } else {
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

function saveToTaskInbox(e) {
  const note = e.formInput.note;
  const details = getMessageDetails(e);

  if (!details) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Unable to save task. Message details not found."))
      .build();
  }

  const taskData = {
    title: details.subject,
    detail: note,
    threadId: details.messageId // Send message ID as thread ID
  };

  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/tasks`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(taskData),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 201 && result.success) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(result.message))
        .setNavigation(CardService.newNavigation().pushCard(createHomeCard()))
        .build();
    } else {
      console.error('Error saving task:', result.error || 'Unknown error');
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Failed to save task. Please try again."))
        .build();
    }
  } catch (error) {
    console.error('Error in saveToTaskInbox:', error);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("An error occurred. Please try again."))
      .build();
  }
}

function confirmDeleteTask(e) {
  const taskId = e.parameters.taskId;

  const card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("Confirm Delete"));
  card.addSection(CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Are you sure you want to delete this task?"))
    .addWidget(CardService.newTextButton().setText("Yes")
      .setOnClickAction(CardService.newAction().setFunctionName("deleteTask").setParameters({ taskId: taskId }))
    )
    .addWidget(CardService.newTextButton().setText("No")
      .setOnClickAction(CardService.newAction().setFunctionName("onHomepage"))
    )
  );

  return card.build();
}

function deleteTask(e) {
  const taskId = e.parameters.taskId;

  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'delete',
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 200 && result.success) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(result.message))
        .setNavigation(CardService.newNavigation().pushCard(createHomeCard()))
        .build();
    } else {
      console.error('Error deleting task:', result.error || 'Unknown error');
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Failed to delete task. Please try again."))
        .build();
    }
  } catch (error) {
    console.error('Error in deleteTask:', error);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("An error occurred. Please try again."))
      .build();
  }
}

function getTasks() {
  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/tasks`, {
      method: 'get',
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());
    if (response.getResponseCode() === 200 && result.success) {
      return result.tasks;
    } else {
      console.error('Error fetching tasks:', result.error || 'Unknown error');
      return [];
    }
  } catch (error) {
    console.error('Error in getTasks:', error);
    return [];
  }
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

function editTaskCard(e) {
  const taskId = e.parameters.taskId;
  const threadId = e.parameters.threadId; // Get the thread ID from parameters
  const tasks = getTasksByMessageId(threadId);
  const task = tasks.find(t => t._id === taskId);

  if (!task) {
    return CardService.newCardBuilder()
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText("Task not found.")))
      .build();
  }

  const emailDetails = getMessageDetailsById(threadId);

  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection();

  // Populate input fields with task details
  section.addWidget(CardService.newTextInput().setFieldName('title').setTitle('Title').setValue(task.title || ''));
  section.addWidget(CardService.newTextInput().setFieldName('detail').setTitle('Detail').setValue(task.detail || ''));
  section.addWidget(CardService.newTextButton().setText('Update Task').setOnClickAction(CardService.newAction().setFunctionName('updateTask').setParameters({ taskId: taskId })));

  if (emailDetails) {
    section.addWidget(CardService.newTextParagraph().setText('From: ' + emailDetails.from));
    section.addWidget(CardService.newTextParagraph().setText('To: ' + emailDetails.to));
    section.addWidget(CardService.newTextParagraph().setText('Subject: ' + emailDetails.subject));

    // Process and display HTML body content (limited HTML tags allowed)
    const bodyText = formatBodyText(emailDetails.body);
    console.log("bodyText",bodyText)
    section.addWidget(CardService.newTextParagraph().setText('Body: ' + bodyText));
  }

  card.addSection(section);

  return card.build();
}

function updateTask(e) {
  const taskId = e.parameters.taskId;
  const title = e.formInput.title;
  const detail = e.formInput.detail;

  const taskData = {
    title: title,
    detail: detail
  };

  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(taskData),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 200 && result.success) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(result.message))
        .setNavigation(CardService.newNavigation().pushCard(createHomeCard()))
        .build();
    } else {
      console.error('Error updating task:', result.error || 'Unknown error');
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Failed to update task. Please try again."))
        .build();
    }
  } catch (error) {
    console.error('Error in updateTask:', error);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("An error occurred. Please try again."))
      .build();
  }
}

function displayMessageDetails(e) {
  const details = getMessageDetails(e);
  console.log("details.body---", details.body)

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
  
  // Process and display formatted HTML body content
  const bodyText = formatBodyText(details.body);
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

function getTasksByThreadId(threadId) {
  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/tasks/thread/${threadId}`, {
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());
    if (response.getResponseCode() === 200 && result.success) {
      return result.tasks;
    } else {
      console.error('Error fetching tasks by thread ID:', result.error || result.message || 'Unknown error');
      return [];
    }
  } catch (error) {
    console.error('Error in getTasksByThreadId:', error);
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
    body: message.getBody(), // Changed to getBody() to get HTML content
    messageId: messageId
  };
}

function getMessageDetailsById(messageId) {
  if (!messageId) {
    console.error('No message ID provided');
    return null;
  }

  const message = GmailApp.getMessageById(messageId);
  console.log("message -",message)

  if (!message) {
    console.error('No message found with ID: ' + messageId);
    return null;
  }

  return {
    from: message.getFrom(),
    to: message.getTo(),
    subject: message.getSubject(),
    body: message.getBody(), // Changed to getBody() to get HTML content
    messageId: messageId
  };
}

// Utility function to format text from HTML content
function formatBodyText(htmlContent) {
  const tempElement = HtmlService.createHtmlOutput(htmlContent).getContent();
  
  // Remove inline CSS rules and non-content tags
  const cleanedHtml = tempElement
    .replace(/<style[^>]*>.*?<\/style>/g, '') // Remove <style> tags
    .replace(/<script[^>]*>.*?<\/script>/g, '') // Remove <script> tags
    .replace(/@media[^{]+\{([\s\S]+?)\}[^\}]*\}/g, '') // Remove media queries
    .replace(/body\s*\{[^}]*\}/g, '') // Remove body CSS rules
  
  // Decode HTML entities and replace paragraph tags with newlines
  const formattedText = cleanedHtml
    .replace(/<\/p>/g, '\n\n')
    .replace(/<[^>]+>/g, '') // Remove all other HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Remove excessive whitespace and repetitive text
  const cleanedText = formattedText
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .trim();

  return cleanedText;
}
