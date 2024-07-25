const API_BASE_URL = 'https://simple-gmail-tasks.onrender.com/api';

// Entry point for the home page
function getHomePage(e) {
  return createHomeCard();
}

// Fetch all tasks from the API
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

// Fetch tasks by message ID
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

// Create the home card to show all tasks
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

// Save a new task to the inbox
function saveToTaskInbox(e) {
  const threadId = e.parameters.threadId; // Get threadId from function argument
  const emailTo = e.parameters.emailTo;  // Get emailTo from function argument

  const taskData = {
    title: e.formInput.title,
    detail: e.formInput.detail,
    threadId: threadId,
    emailFrom: e.formInput.emailFrom,
    emailTo: emailTo,
    emailSubject: e.formInput.emailSubject,
    emailBody: e.formInput.emailBody
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

// Confirm task deletion
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
      .setOnClickAction(CardService.newAction().setFunctionName("getHomePage"))
    )
  );

  return card.build();
}

// Delete a task
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

// Create or edit a task card
function editTaskCard(e) {
  const taskId = e.parameters.taskId;
  const threadId = e.parameters.threadId;

  // Fetch task details from the API
  const response = UrlFetchApp.fetch(`${API_BASE_URL}/tasks/thread/${threadId}`, {
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());

  if (response.getResponseCode() === 200 && result.success) {
    const task = result.tasks.find(t => t._id === taskId);

    if (task) {
      return createEditTaskCard(task);
    } else {
      return CardService.newCardBuilder()
        .addSection(CardService.newCardSection()
          .addWidget(CardService.newTextParagraph().setText('Task not found.')))
        .build();
    }
  } else {
    console.error('Error fetching task by thread ID:', result.error || 'Unknown error');
    return CardService.newCardBuilder()
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('Error retrieving task details.')))
      .build();
  }
}

// Update an existing task
function updateTask(e) {
  const taskId = e.parameters.taskId;
  const taskData = {
    title: e.formInput.title,
    detail: e.formInput.detail,
    emailFrom: e.formInput.emailFrom,
    emailSubject: e.formInput.emailSubject,
    emailBody: e.formInput.emailBody
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

// Display message details and create or edit task
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

  if (tasks.length > 0) {
    // If tasks exist, show edit screen for the first task
    const task = tasks[0];
    return createEditTaskCard(task);
  } else {
    // Show a Create Task button initially
    const section = CardService.newCardSection()
      .addWidget(CardService.newTextButton()
        .setText('Create Task')
        .setOnClickAction(CardService.newAction().setFunctionName('showCreateTaskForm').setParameters({ messageId: details.messageId }))
      );

    card.addSection(section);
  }

  return card.build();
}

// Function to display the task creation form
function showCreateTaskForm(e) {
  const messageId = e.parameters.messageId;
  const details = getMessageDetailsById(messageId);

  const section = CardService.newCardSection()
    .addWidget(CardService.newTextInput()
      .setFieldName('title')
      .setTitle('Title')
      .setValue(details.subject || '') // Populate with email subject
    )
    .addWidget(CardService.newTextInput()
      .setFieldName('emailFrom')
      .setTitle('Email From')
      .setValue(details.from || '') // Populate with email sender
    )
    .addWidget(CardService.newTextInput()
      .setFieldName('emailSubject')
      .setTitle('Email Subject')
      .setValue(details.subject || '') // Populate with email subject
    )
    .addWidget(CardService.newTextInput()
      .setFieldName('emailBody')
      .setTitle('Email Body')
      .setValue(details.body || '') // Populate with email body
      .setMultiline(true)
    )
    .addWidget(CardService.newTextInput()
      .setFieldName('detail')
      .setTitle('Add details for task')
      .setValue('') // Default to empty, user can add notes
    )
    .addWidget(CardService.newTextButton()
      .setText('Save to Task Inbox')
      .setOnClickAction(CardService.newAction().setFunctionName('saveToTaskInbox').setParameters({ threadId: messageId, emailTo: details.to }))
    );

  const card = CardService.newCardBuilder()
    .addSection(section)
    .build();

  return card;
}

// Create or edit task card
function createEditTaskCard(task) {
  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextInput()
      .setFieldName('title')
      .setTitle('Title')
      .setValue(task.title || '')
    )
    .addWidget(CardService.newTextInput()
      .setFieldName('detail')
      .setTitle('Detail')
      .setValue(task.detail || '')
    )
    .addWidget(CardService.newTextInput()
      .setFieldName('emailFrom')
      .setTitle('Email From')
      .setValue(task.emailFrom || '')
    )
    .addWidget(CardService.newTextInput()
      .setFieldName('emailSubject')
      .setTitle('Email Subject')
      .setValue(task.emailSubject || '')
    )
    .addWidget(CardService.newTextInput()
      .setFieldName('emailBody')
      .setTitle('Email Body')
      .setValue(task.emailBody || '')
      .setMultiline(true)
    )
    .addWidget(CardService.newTextButton()
      .setText('Update Task')
      .setOnClickAction(CardService.newAction().setFunctionName('updateTask').setParameters({ taskId: task._id }))
    );

  card.addSection(section);

  return card.build();
}

function getMessageDetails(e) {
  try {
    const accessToken = e.messageMetadata.accessToken;
    const messageId = e.messageMetadata.messageId;
    const message = GmailApp.getMessageById(messageId);
    const thread = message.getThread();
    const from = message.getFrom();
    const to = message.getTo();
    const subject = message.getSubject();
    const body = removeHttpLinks(message.getPlainBody()); // Remove HTTP links
    const attachments = message.getAttachments().map(attachment => ({
      name: attachment.getName(),
      mimeType: attachment.getContentType(),
      size: attachment.getSize()
    }));

    const fullBody = message.getPlainBody();
    Logger.log("fullBody: %s", fullBody);
    Logger.log("filter - plainbody: %s", body);

    return {
      messageId: thread.getId(),
      from: from,
      to: to,
      subject: subject,
      body: body,
      attachments: attachments
    };
  } catch (error) {
    Logger.log('Error in getMessageDetails: %s', error.toString());
  }
}

// Fetch message details by thread ID
function getMessageDetailsById(threadId) {
  try {
    const thread = GmailApp.getThreadById(threadId);
    const messages = thread.getMessages();

    if (messages.length === 0) {
      console.error('No messages found in the thread.');
      return null;
    }

    const message = messages[0]; // Assuming we want the details of the first message in the thread
    const from = message.getFrom();
    const to = message.getTo();
    const subject = message.getSubject();
    const body = removeHttpLinks(message.getPlainBody()); // Remove HTTP links

    const attachments = message.getAttachments().map(attachment => ({
      name: attachment.getName(),
      mimeType: attachment.getContentType(),
      size: attachment.getSize()
    }));

    return {
      messageId: thread.getId(),
      from: from,
      to: to,
      subject: subject,
      body: body,
      attachments: attachments
    };
  } catch (error) {
    console.error('Error fetching message details by ID:', error);
    return null;
  }
}

// Remove HTTP links from text
function removeHttpLinks(text) {
  const urlPattern = /https?:\/\/[^\s]+/g;
  return text.replace(urlPattern, '');
}
