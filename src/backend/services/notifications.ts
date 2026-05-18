import { query } from '../db';

// Dynamic import for LINE SDK to avoid SSR issues
let lineClient: any = null;

async function getLineClient() {
  if (!lineClient) {
    try {
      const { Client } = await import('@line/bot-sdk');
      const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      
      if (!channelAccessToken) {
        console.warn('LINE_CHANNEL_ACCESS_TOKEN not configured');
        return null;
      }
      
      lineClient = new Client({
        channelAccessToken,
      });
    } catch (error) {
      console.error('Failed to initialize LINE client:', error);
      return null;
    }
  }
  return lineClient;
}

export type NotificationType = 
  | 'customer_overdue'
  | 'new_customer'
  | 'customer_deleted'
  | 'temporary_credit_increase'
  | 'temporary_credit_deactivate'
  | 'credit_limit_change';

export interface NotificationData {
  type: NotificationType;
  data: any;
}

class LineNotificationService {
  private adminUserId: string | null = null;
  private useBroadcast: boolean = false;

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    const adminUserId = process.env.LINE_ADMIN_USER_ID;
    const useBroadcast = process.env.LINE_USE_BROADCAST === 'true';
    
    this.useBroadcast = useBroadcast;
    
    if (!useBroadcast && !adminUserId) {
      console.warn('LINE_ADMIN_USER_ID not configured and LINE_USE_BROADCAST is false');
      return;
    }
    
    if (!useBroadcast) {
      this.adminUserId = adminUserId ?? null;
    }
    
    console.log(`LINE notification mode: ${useBroadcast ? 'Broadcast (all friends)' : 'Single user'}`);
  }

  private async sendLineMessage(message: string): Promise<boolean> {
    if (!this.useBroadcast && !this.adminUserId) {
      console.warn('LINE admin user ID not configured');
      return false;
    }

    try {
      const client = await getLineClient();
      if (!client) {
        console.warn('LINE client not available');
        return false;
      }

      if (this.useBroadcast) {
        // ส่งให้ทุกคนที่เพิ่มเป็นเพื่อน
        await client.broadcast({
          type: 'text',
          text: message,
        });
        console.log('LINE broadcast notification sent successfully');
      } else {
        // ส่งให้คนเดียว
        await client.pushMessage(this.adminUserId, {
          type: 'text',
          text: message,
        });
        console.log('LINE notification sent successfully');
      }
      return true;
    } catch (error) {
      console.error('Failed to send LINE notification:', error);
      return false;
    }
  }

  async sendNotification(type: NotificationType, data: any): Promise<boolean> {
    const message = this.formatMessage(type, data);
    return await this.sendLineMessage(message);
  }

  private formatMessage(type: NotificationType, data: any): string {
    const timestamp = new Date().toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    switch (type) {
      case 'customer_overdue':
        return `🚨 แจ้งเตือนลูกค้าเลยกำหนดชำระ
⏰ ${timestamp}
📋 เลขที่ PO: ${data.po_number}
👤 ลูกค้า: ${data.customer_name}
💰 ยอดค้าง: ${data.remaining_amount.toLocaleString()} บาท
⚠️ เลยกำหนด: ${data.days_overdue} วัน
🔗 ตรวจสอบ: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/po/${data.po_id}`;

      case 'new_customer':
        return `👥 ลูกค้าใหม่
⏰ ${timestamp}
🏢 ชื่อ: ${data.name}
📋 รหัส: ${data.code}
💳 วงเงิน: ${data.credit_limit?.toLocaleString() || 0} บาท
📞 เบอร์: ${data.phone || '-'}
🔗 ดูรายละเอียด: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/customers/${data.id}`;

      case 'temporary_credit_increase':
        return `📈 ขอเพิ่มวงเงินชั่วคราว
⏰ ${timestamp}
👤 ลูกค้า: ${data.customer_name}
📋 รหัส: ${data.customer_code}
💰 วงเงินเดิม: ${data.old_limit?.toLocaleString() || 0} บาท
💰 เพิ่ม: ${data.amount?.toLocaleString() || 0} บาท
💰 รวม: ${data.new_limit?.toLocaleString() || 0} บาท
📝 เหตุผล: ${data.reason || '-'}
🔗 อนุมัติ: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/customers/${data.customer_id}`;

      case 'credit_limit_change':
        const action = data.new_limit > data.old_limit ? 'เพิ่ม' : 'ลด';
        return `📊 แก้ไขวงเงินลูกค้า
⏰ ${timestamp}
👤 ลูกค้า: ${data.customer_name}
📋 รหัส: ${data.customer_code}
🔄 การแก้ไข: ${action}วงเงิน
💰 จาก: ${data.old_limit?.toLocaleString() || 0} บาท
💰 เป็น: ${data.new_limit?.toLocaleString() || 0} บาท
📝 ผู้แก้ไข: ${data.updated_by || '-'}
🔗 ดูรายละเอียด: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/customers/${data.customer_id}`;

      case 'customer_deleted':
        return `🗑️ ลบลูกค้า
⏰ ${timestamp}
🏢 ชื่อ: ${data.customer_name}
📋 รหัส: ${data.customer_code || '-'}
👤 ผู้ติดต่อ: ${data.contact_person || '-'}
🗑️ ผู้ลบ: ${data.deleted_by || 'System'}
📝 ลบเมื่อ: ${new Date(data.deleted_at).toLocaleString('th-TH')}
⚠️ ข้อมูลลูกค้าและประวัติทั้งหมดถูกลบถาวร`;

      case 'temporary_credit_deactivate':
        return `🚫 ยกเลิกวงเงินชั่วคราว
⏰ ${timestamp}
👤 ลูกค้า: ${data.customer_name}
📋 รหัส: ${data.customer_code}
💰 ยกเลิกวงเงิน: ${data.extra_amount?.toLocaleString() || 0} บาท
💰 วงเงินปัจจุบัน: ${data.base_limit?.toLocaleString() || 0} บาท
📝 ผู้ยกเลิก: ${data.deactivated_by || '-'}
🔗 ดูรายละเอียด: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/customers/${data.customer_id}`;

      default:
        return `📢 แจ้งเตือนระบบ FlowSync
⏰ ${timestamp}
${JSON.stringify(data)}`;
    }
  }

  // ฟังก์ชันสำหรับตรวจสอบและแจ้งเตือนลูกค้าเลยกำหนดชำระ
  async checkAndNotifyOverdueCustomers(): Promise<void> {
    try {
      const overduePos = await query<{
        id: number;
        po_number: string;
        customer_name: string;
        total: number;
        remaining_amount: number;
        days_overdue: number;
        status: string;
        payment_status: string;
      }>(
        `SELECT po.id, po.po_number, c.name AS customer_name, po.total, po.remaining_amount,
                DATEDIFF(CURDATE(), po.due_date) AS days_overdue, po.status, po.payment_status
         FROM purchase_orders po
         JOIN customers c ON c.id = po.customer_id
         WHERE po.status <> 'cancelled' AND po.payment_status <> 'paid'
           AND po.due_date IS NOT NULL AND po.due_date < CURDATE()
         ORDER BY po.due_date ASC`
      );

      for (const po of overduePos) {
        // แจ้งเตือนเฉพาะกรณีที่เลยกำหนดครบ 3, 7, 14, 30 วัน
        if ([3, 7, 14, 30].includes(po.days_overdue)) {
          await this.sendNotification('customer_overdue', {
            po_id: po.id,
            po_number: po.po_number,
            customer_name: po.customer_name,
            remaining_amount: po.remaining_amount,
            days_overdue: po.days_overdue,
          });
        }
      }
    } catch (error) {
      console.error('Error checking overdue customers:', error);
    }
  }

  // ฟังก์ชันสำหรับทดสอบการส่งข้อความ
  async testConnection(): Promise<boolean> {
    const testMessage = `🧪 ทดสอบการเชื่อมต่อ LINE Notification
⏰ ${new Date().toLocaleString('th-TH')}
✅ ระบบแจ้งเตือน FlowSync ทำงานปกติ`;
    
    return await this.sendLineMessage(testMessage);
  }
}

// Singleton instance
export const lineNotificationService = new LineNotificationService();

// Export functions for easy use
export const sendLineNotification = (type: NotificationType, data: any) => 
  lineNotificationService.sendNotification(type, data);

export const checkOverdueCustomers = () => 
  lineNotificationService.checkAndNotifyOverdueCustomers();

export const testLineConnection = () => 
  lineNotificationService.testConnection();
