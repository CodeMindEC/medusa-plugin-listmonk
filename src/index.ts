import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import ListmonkNotificationService from "./services/listmonk-notification"

export default ModuleProvider(Modules.NOTIFICATION, {
    services: [ListmonkNotificationService],
})
