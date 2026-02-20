import {
    AbstractNotificationProviderService,
    MedusaError
} from "@medusajs/framework/utils"
import {
    ProviderSendNotificationDTO,
    ProviderSendNotificationResultsDTO,
    Logger
} from "@medusajs/framework/types"

type ListmonkOptions = {
    url: string
    username?: string
    password?: string
    from_email: string
    list_id?: string
    list_uuid?: string // Optional, just in case needed for other endpoints
    template_map?: Record<string, string | number>
}

type InjectedDependencies = {
    logger: Logger
}

// Custom type for notification data payload to handle template_id
type ListmonkNotificationData = {
    template_id?: string | number
    [key: string]: unknown
}


export class ListmonkNotificationService extends AbstractNotificationProviderService {
    static identifier = "notification-listmonk"
    protected options: ListmonkOptions
    protected logger: Logger

    constructor({ logger }: InjectedDependencies, options: ListmonkOptions) {
        super()
        this.logger = logger
        this.options = options

        // Validate configuration
        if (!this.options.url) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Listmonk URL not configured. Please set LISTMONK_URL."
            )
        }
        if (!this.options.from_email) {
            this.logger.warn("Listmonk 'from_email' not configured. Using default from Listmonk settings if available.")
        }
        this.logger.info(`[Listmonk] Initialized with options: url=${this.options.url}, list_id=${this.options.list_id}, from_email=${this.options.from_email}`)
    }

    async send(
        notification: ProviderSendNotificationDTO
    ): Promise<ProviderSendNotificationResultsDTO> {
        const { to, template, data } = notification
        const notificationData = (data || {}) as ListmonkNotificationData

        if (!to) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Listmonk: 'to' (recipient email) is required"
            )
        }

        // 1. Resolve Template ID
        let templateId: string | number | undefined = notificationData.template_id

        if (!templateId && this.options.template_map) {
            templateId = this.options.template_map[template]
        }

        if (!templateId) {
            templateId = template
            if (isNaN(Number(templateId)) && !templateId.includes("-")) {
                this.logger.warn(`[Listmonk] Using '${template}' as template ID. If this is a semantic name, please map it in medusa-config.`)
            }
        }

        if (!templateId) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "No template ID resolved for Listmonk notification"
            )
        }

        // Ensure subscriber exists in Listmonk before sending
        await this.createSubscriber(to, notificationData)

        const payload: any = {
            subscriber_email: to,
            template_id: Number.isInteger(Number(templateId)) ? Number(templateId) : templateId,
            data: notificationData,
            content_type: "html"
        }

        // Only add from_email if configured
        if (this.options.from_email) {
            payload.from_email = this.options.from_email
        }

        // Add attachments if present
        if (notification.attachments && notification.attachments.length > 0) {
            payload.attachments = notification.attachments.map(att => {
                let content = att.content;
                if (Buffer.isBuffer(content)) {
                    content = content.toString('base64');
                }
                return {
                    filename: att.filename,
                    content: content,
                    content_type: att.content_type || 'application/pdf'
                };
            });
        }

        return await this.sendRequest(payload, to, templateId)
    }

    private async sendRequest(payload: any, to: string, templateId: string | number) {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }

        if (this.options.username && this.options.password) {
            const auth = Buffer.from(`${this.options.username}:${this.options.password}`).toString("base64")
            headers["Authorization"] = `Basic ${auth}`
        }

        this.logger.info(`[Listmonk] Sending tx email to ${to} with template ${templateId}`)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15_000)

        try {
            const response = await fetch(`${this.options.url}/api/tx`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal,
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Listmonk API error ${response.status}: ${errorText}`)
            }

            this.logger.info(`[Listmonk] Sent email to ${to} (Template: ${templateId})`)

            return {
                id: `listmonk-tx-${Date.now()}`,
            }
        } finally {
            clearTimeout(timeout)
        }
    }

    private async createSubscriber(email: string, data: any) {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }

        if (this.options.username && this.options.password) {
            const auth = Buffer.from(`${this.options.username}:${this.options.password}`).toString("base64")
            headers["Authorization"] = `Basic ${auth}`
        }

        // Extract name from data if available
        let name = email
        if (data.customer_id) name = data.customer_id
        if (data.raw_data?.customer?.first_name) name = `${data.raw_data.customer.first_name} ${data.raw_data.customer.last_name}`.trim()

        // Use shipping address for name if available (common in order-placed)
        if (data.shipping_address?.first_name) {
            name = `${data.shipping_address.first_name} ${data.shipping_address.last_name}`.trim()
        }

        const payload = {
            email: email,
            name: name,
            status: "enabled",
            lists: [Number(this.options.list_id || 1)], // Use configured list or fallback to 1
            preconfirm_subscriptions: true,
            attribs: {
                source: "medusa",
            }
        }

        this.logger.info(`[Listmonk] Ensuring subscriber exists: ${email}`)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15_000)

        let response: Response
        try {
            response = await fetch(`${this.options.url}/api/subscribers`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal,
            })
        } finally {
            clearTimeout(timeout)
        }

        const responseText = await response.text()

        if (!response.ok) {
            // Ignore if already exists (race condition), otherwise throw
            if (!responseText.includes("already exists")) {
                throw new Error(`Listmonk API error ${response.status}: ${responseText}`)
            }
        }
    }
}

export default ListmonkNotificationService
