/**
 * Service Worker for Alpha-Numeric App
 */

const NOTIFICATION_TAG = 'alpha-numeric-reminder';

// Listen for the 'activate' event to take control immediately.
self.addEventListener('activate', event => {
    console.log('Service Worker activated.');
    // This ensures the new service worker takes over all clients immediately.
    event.waitUntil(clients.claim());
});

// Main event listener for handling clicks on notification buttons.
self.addEventListener('notificationclick', event => {
    const noteId = event.notification.data.noteId;
    const action = event.action;

    console.log(`Notification for Note ID ${noteId} clicked. Action: ${action}`);

    // Close the notification
    event.notification.close();

    // Perform action based on which button was clicked.
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(() => {
            if (action === 'mark-done') {
                return handleMarkDone(noteId);
            } else if (action.startsWith('snooze-')) {
                const minutes = parseInt(action.split('-')[1]);
                return handleSnooze(noteId, minutes);
            }
        })
    );
});

// Listen for messages from the main application script.
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CHECK_REMINDERS') {
        console.log('Service Worker received CHECK_REMINDERS message.');
        checkForReminders();
    }
});

/**
 * Checks localStorage for notes due today and shows notifications.
 */
function checkForReminders() {
    const notesJSON = self.localStorage.getItem('notes-app-notes');
    if (!notesJSON) return;

    const notes = JSON.parse(notesJSON);
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    notes.forEach(note => {
        // Check if the note is due today, not deleted, and hasn't been reminded yet today.
        if (note.dueDateFormatted === todayStr && !note.deleted) {
            const remindedToday = self.localStorage.getItem(`reminded-${note.id}-${todayStr}`);
            if (!remindedToday) {
                console.log(`Showing notification for note ID: ${note.id}`);
                showNotification(note);
                // Mark that a reminder has been sent for this note today to avoid duplicates.
                self.localStorage.setItem(`reminded-${note.id}-${todayStr}`, 'true');
            }
        }
    });
}

/**
 * Finds the note by ID, marks it for deletion, and saves the state.
 * @param {number} noteId The ID of the note to mark as done.
 */
function handleMarkDone(noteId) {
    const notesJSON = self.localStorage.getItem('notes-app-notes');
    if (!notesJSON) return;
    let notes = JSON.parse(notesJSON);
    const noteIndex = notes.findIndex(n => n.id === noteId);
    if (noteIndex > -1) {
        notes[noteIndex].deleted = true;
        self.localStorage.setItem('notes-app-notes', JSON.stringify(notes));
        console.log(`Note ID ${noteId} marked as done.`);
    }
}

/**
 * Schedules a new notification for a later time.
 * @param {number} noteId The ID of the note to snooze.
 * @param {number} minutes The number of minutes to snooze for.
 */
function handleSnooze(noteId, minutes) {
    const notesJSON = self.localStorage.getItem('notes-app-notes');
    if (!notesJSON) return;
    const notes = JSON.parse(notesJSON);
    const note = notes.find(n => n.id === noteId);
    if (note) {
        console.log(`Snoozing note ID ${noteId} for ${minutes} minutes.`);
        setTimeout(() => showNotification(note), minutes * 60 * 1000);
    }
}

/**
 * Displays the notification with action buttons.
 * @param {object} note The note object to display a notification for.
 */
function showNotification(note) {
    const options = {
        body: `Reminder: "${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}"`,
        icon: '/favicon.ico', // Optional: Add a favicon to your project folder
        tag: `${NOTIFICATION_TAG}-${note.id}`,
        renotify: true,
        data: { noteId: note.id },
        actions: [
            { action: 'mark-done', title: 'Yes, Done' },
            { action: 'snooze-15', title: 'Snooze 15m' },
        ]
    };
    self.registration.showNotification('Alpha-Numeric Reminder', options);
}