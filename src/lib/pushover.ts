/**
 * Pushover notification service for sending push notifications
 */

const PUSHOVER_API_URL = 'https://api.pushover.net/1/messages.json'

// Pushover credentials
const PUSHOVER_USER_KEY = 'uwkw4brd7s13oaigns171fa7gj18s8'
const PUSHOVER_APP_TOKEN = 'h9foydp5fx' // Note: This appears to be an email, you may need to replace with actual app token

interface PushoverMessage {
  title: string
  message: string
  url?: string
  url_title?: string
  priority?: -2 | -1 | 0 | 1 | 2
  sound?: string
}

/**
 * Send a push notification via Pushover
 */
export async function sendPushoverNotification(options: PushoverMessage): Promise<boolean> {
  try {
    const response = await fetch(PUSHOVER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: PUSHOVER_APP_TOKEN,
        user: PUSHOVER_USER_KEY,
        title: options.title,
        message: options.message,
        ...(options.url && { url: options.url }),
        ...(options.url_title && { url_title: options.url_title }),
        ...(options.priority !== undefined && { priority: String(options.priority) }),
        ...(options.sound && { sound: options.sound }),
      }),
    })

    if (!response.ok) {
      console.error('Pushover notification failed:', response.statusText)
      return false
    }

    const result = await response.json()
    return result.status === 1
  } catch (error) {
    console.error('Failed to send Pushover notification:', error)
    return false
  }
}

/**
 * Send notification for a new comment
 */
export async function notifyNewComment(options: {
  authorName: string | null
  commentBody: string
  processName?: string
  projectName?: string
  stepTitle?: string
}): Promise<void> {
  const { authorName, commentBody, processName, projectName, stepTitle } = options
  
  const author = authorName || 'Someone'
  const truncatedBody = commentBody.length > 200 
    ? commentBody.substring(0, 200) + '...' 
    : commentBody

  let title = '💬 New Comment on Nestland'
  let context = ''

  if (projectName && stepTitle) {
    title = `💬 New Comment on ${projectName}`
    context = `Step: ${stepTitle}\n\n`
  } else if (processName) {
    title = `💬 New Comment on ${processName}`
  }

  const message = `${author} commented:\n${context}${truncatedBody}`

  await sendPushoverNotification({
    title,
    message,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    url_title: 'Open Nestland',
    priority: 0,
  })
}
