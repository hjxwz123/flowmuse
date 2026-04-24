-- AlterEnum
ALTER TABLE `credit_logs` MODIFY `type` ENUM('redeem', 'consume', 'refund', 'admin_adjust', 'expire') NOT NULL;
