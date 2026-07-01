-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jul 01, 2026 at 05:42 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `flowsync`
--

-- --------------------------------------------------------

--
-- Table structure for table `billing_notes`
--

CREATE TABLE `billing_notes` (
  `id` int(11) NOT NULL,
  `bn_number` varchar(20) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `issued_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `billing_note_items`
--

CREATE TABLE `billing_note_items` (
  `id` int(11) NOT NULL,
  `billing_note_id` int(11) NOT NULL,
  `po_id` int(11) NOT NULL,
  `po_number` varchar(30) NOT NULL,
  `po_date` date NOT NULL,
  `tax_invoice_number` varchar(50) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `credit_limit_adjustments`
--

CREATE TABLE `credit_limit_adjustments` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `adjusted_by` int(11) NOT NULL,
  `delta` decimal(14,2) NOT NULL,
  `new_limit` decimal(14,2) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `credit_limit_requests`
--

CREATE TABLE `credit_limit_requests` (
  `id` int(11) NOT NULL,
  `request_type` enum('permanent_increase','temporary') NOT NULL,
  `customer_id` int(11) NOT NULL,
  `amount` decimal(14,2) DEFAULT NULL,
  `extra_amount` decimal(14,2) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `requested_by` int(11) NOT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(255) DEFAULT NULL,
  `approval_token` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `credit_notes`
--

CREATE TABLE `credit_notes` (
  `id` int(11) NOT NULL,
  `cn_number` varchar(32) NOT NULL,
  `po_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `total_original` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total_new` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total_diff` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','voided') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `credit_note_items`
--

CREATE TABLE `credit_note_items` (
  `id` int(11) NOT NULL,
  `credit_note_id` int(11) NOT NULL,
  `po_item_id` int(11) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT 1.00,
  `unit` varchar(50) DEFAULT NULL,
  `original_price` decimal(14,2) NOT NULL,
  `new_price` decimal(14,2) NOT NULL,
  `diff_amount` decimal(14,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `credit_note_logs`
--

CREATE TABLE `credit_note_logs` (
  `id` int(11) NOT NULL,
  `credit_note_id` int(11) NOT NULL,
  `action` enum('created','updated','voided') NOT NULL,
  `performed_by` int(11) NOT NULL,
  `summary` varchar(255) DEFAULT NULL,
  `changes` mediumtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `code` varchar(32) DEFAULT NULL,
  `name` varchar(191) NOT NULL,
  `contact_person` varchar(128) DEFAULT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `email` varchar(128) DEFAULT NULL,
  `tax_id` varchar(32) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `credit_limit` decimal(14,2) NOT NULL DEFAULT 0.00,
  `credit_score` int(11) DEFAULT NULL,
  `credit_score_notes` text DEFAULT NULL,
  `default_credit_term_days` int(11) DEFAULT 30,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `billing_note_due_days` int(11) DEFAULT 5
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_credit_notes`
--

CREATE TABLE `customer_credit_notes` (
  `id` int(11) NOT NULL,
  `ccn_number` varchar(32) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `po_id` int(11) NOT NULL,
  `payment_id` int(11) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `status` enum('active','used','refunded','expired') NOT NULL DEFAULT 'active',
  `usage_type` enum('keep_as_credit','refund_to_customer') NOT NULL DEFAULT 'keep_as_credit',
  `used_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `refunded_at` datetime DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `expires_at` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_credit_note_usages`
--

CREATE TABLE `customer_credit_note_usages` (
  `id` int(11) NOT NULL,
  `ccn_id` int(11) NOT NULL,
  `po_id` int(11) DEFAULT NULL,
  `amount_used` decimal(14,2) NOT NULL,
  `usage_type` enum('applied_to_po','refunded') NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_edit_logs`
--

CREATE TABLE `customer_edit_logs` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `edited_by` int(11) NOT NULL,
  `summary` varchar(255) NOT NULL,
  `changes` mediumtext NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_files`
--

CREATE TABLE `customer_files` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `mime_type` varchar(128) NOT NULL DEFAULT 'application/octet-stream',
  `file_size` int(11) NOT NULL DEFAULT 0,
  `uploaded_by` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory`
--

CREATE TABLE `inventory` (
  `id` int(11) NOT NULL,
  `store` int(11) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `upc` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `vendor` int(11) DEFAULT NULL,
  `vendor_name` varchar(255) DEFAULT NULL,
  `d` int(11) DEFAULT NULL,
  `sd` int(11) DEFAULT NULL,
  `c` int(11) DEFAULT NULL,
  `sc` varchar(50) DEFAULT NULL,
  `group_name` varchar(100) DEFAULT NULL,
  `group_sd` varchar(100) DEFAULT NULL,
  `group_cat` varchar(100) DEFAULT NULL,
  `mer` varchar(50) DEFAULT NULL,
  `mer_name` varchar(255) DEFAULT NULL,
  `ishida` varchar(50) DEFAULT NULL,
  `on_hand` int(11) DEFAULT 0,
  `on_order` int(11) DEFAULT 0,
  `on_transfer` int(11) DEFAULT 0,
  `in_transit` int(11) DEFAULT 0,
  `hold_qty` int(11) DEFAULT 0,
  `stock_value` decimal(12,2) DEFAULT NULL,
  `date_last_sold` date DEFAULT NULL,
  `synced_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` int(11) NOT NULL,
  `invoice_number` varchar(32) NOT NULL,
  `po_id` int(11) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `generated_at` datetime NOT NULL DEFAULT current_timestamp(),
  `generated_by` int(11) NOT NULL,
  `download_count` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoice_logs`
--

CREATE TABLE `invoice_logs` (
  `id` int(11) NOT NULL,
  `invoice_id` int(11) NOT NULL,
  `action` enum('created','downloaded','printed','viewed') NOT NULL DEFAULT 'viewed',
  `user_id` int(11) NOT NULL,
  `user_name` varchar(128) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `po_id` int(11) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `paid_at` datetime NOT NULL,
  `method` varchar(32) DEFAULT 'transfer',
  `reference` varchar(128) DEFAULT NULL,
  `slip_path` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `jda_job_id` varchar(64) DEFAULT NULL,
  `jda_synced_at` datetime DEFAULT NULL,
  `recorded_by` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `po_edit_logs`
--

CREATE TABLE `po_edit_logs` (
  `id` int(11) NOT NULL,
  `po_id` int(11) NOT NULL,
  `edited_by` int(11) NOT NULL,
  `summary` varchar(255) NOT NULL,
  `changes` mediumtext NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `po_items`
--

CREATE TABLE `po_items` (
  `id` int(11) NOT NULL,
  `po_id` int(11) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `quantity` decimal(12,2) NOT NULL DEFAULT 1.00,
  `unit` varchar(32) DEFAULT 'pcs',
  `unit_price` decimal(14,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(14,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `store` smallint(6) NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'THB',
  `sku` varchar(32) NOT NULL,
  `description` varchar(512) NOT NULL DEFAULT '',
  `price_use` varchar(32) DEFAULT NULL,
  `current_price` decimal(12,3) NOT NULL DEFAULT 0.000,
  `price_type` varchar(64) DEFAULT NULL,
  `current_start` date DEFAULT NULL,
  `current_end` date DEFAULT NULL,
  `current_event` varchar(64) DEFAULT NULL,
  `original_use` varchar(32) DEFAULT NULL,
  `original_price` decimal(12,3) DEFAULT NULL,
  `original_start` date DEFAULT NULL,
  `original_end` date DEFAULT NULL,
  `original_type` varchar(64) DEFAULT NULL,
  `original_event` varchar(64) DEFAULT NULL,
  `d` smallint(6) DEFAULT NULL,
  `sd` smallint(6) DEFAULT NULL,
  `c` smallint(6) DEFAULT NULL,
  `dept` varchar(64) DEFAULT NULL,
  `sub_dept` varchar(64) DEFAULT NULL,
  `class` varchar(64) DEFAULT NULL,
  `mer` varchar(16) DEFAULT NULL,
  `ishida` varchar(16) DEFAULT NULL,
  `vendor` int(11) DEFAULT NULL,
  `vendor_name` varchar(255) DEFAULT NULL,
  `synced_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_orders`
--

CREATE TABLE `purchase_orders` (
  `id` int(11) NOT NULL,
  `po_number` varchar(32) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `status` enum('draft','confirmed','packed','checked','delivered','received','cancelled') NOT NULL DEFAULT 'draft',
  `payment_status` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `credit_term_days` int(11) NOT NULL DEFAULT 30,
  `subtotal` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `fully_paid_at` datetime DEFAULT NULL COMMENT 'Timestamp when payment_status became paid',
  `remaining_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `signed_doc_path` text DEFAULT NULL,
  `signed_at` datetime DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `tax_invoice_number` varchar(100) DEFAULT NULL,
  `jda_job_id` varchar(64) DEFAULT NULL,
  `jda_po_number` varchar(64) DEFAULT NULL,
  `jda_synced_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `quotations`
--

CREATE TABLE `quotations` (
  `id` int(11) NOT NULL,
  `quote_number` varchar(32) NOT NULL,
  `po_id` int(11) NOT NULL,
  `generated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `temp_credit_limits`
--

CREATE TABLE `temp_credit_limits` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `extra_amount` decimal(14,2) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `request_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `temp_role_grants`
--

CREATE TABLE `temp_role_grants` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `granted_role` enum('super_admin') NOT NULL DEFAULT 'super_admin',
  `granted_by` int(11) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(64) NOT NULL,
  `email` varchar(128) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(128) NOT NULL,
  `role` enum('admin','super_admin') NOT NULL DEFAULT 'admin',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `role`, `created_at`) VALUES
(6, 'superadmin', 'superadmin@rimping.local', '$2b$10$kLbqrx4tvrE89e/tPFHI5Oo7bZ1xLKwFXsdy6pVeaLfdMOILWJAXu', 'Dararat Lapongkhum', 'super_admin', '2026-04-29 10:36:11'),
(12, 'kamijous', 'test@test.cc', '$2b$10$LlXvNK3U0xl.7g6kfIMgLOBYiMi3nUa6axR9TP0Qv/a98r/.DXjWm', 'Suttipong', 'super_admin', '2026-05-13 10:52:21');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `billing_notes`
--
ALTER TABLE `billing_notes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `bn_number` (`bn_number`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `billing_note_items`
--
ALTER TABLE `billing_note_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `billing_note_id` (`billing_note_id`),
  ADD KEY `po_id` (`po_id`);

--
-- Indexes for table `credit_limit_adjustments`
--
ALTER TABLE `credit_limit_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cla_user` (`adjusted_by`),
  ADD KEY `idx_cla_customer` (`customer_id`);

--
-- Indexes for table `credit_limit_requests`
--
ALTER TABLE `credit_limit_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `approval_token` (`approval_token`),
  ADD KEY `fk_clr_requested_by` (`requested_by`),
  ADD KEY `fk_clr_approved_by` (`approved_by`),
  ADD KEY `idx_clr_customer` (`customer_id`),
  ADD KEY `idx_clr_status` (`status`),
  ADD KEY `idx_clr_token` (`approval_token`);

--
-- Indexes for table `credit_notes`
--
ALTER TABLE `credit_notes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cn_number` (`cn_number`),
  ADD KEY `fk_cn_user` (`created_by`),
  ADD KEY `idx_cn_po` (`po_id`),
  ADD KEY `idx_cn_customer` (`customer_id`);

--
-- Indexes for table `credit_note_items`
--
ALTER TABLE `credit_note_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cni_poitem` (`po_item_id`),
  ADD KEY `idx_cni_cn` (`credit_note_id`);

--
-- Indexes for table `credit_note_logs`
--
ALTER TABLE `credit_note_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cnl_user` (`performed_by`),
  ADD KEY `idx_cnl_cn` (`credit_note_id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `customer_credit_notes`
--
ALTER TABLE `customer_credit_notes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ccn_number` (`ccn_number`),
  ADD KEY `fk_ccn_payment` (`payment_id`),
  ADD KEY `fk_ccn_user` (`created_by`),
  ADD KEY `idx_ccn_customer` (`customer_id`),
  ADD KEY `idx_ccn_po` (`po_id`),
  ADD KEY `idx_ccn_status` (`status`);

--
-- Indexes for table `customer_credit_note_usages`
--
ALTER TABLE `customer_credit_note_usages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ccnu_po` (`po_id`),
  ADD KEY `fk_ccnu_user` (`created_by`),
  ADD KEY `idx_ccnu_ccn` (`ccn_id`);

--
-- Indexes for table `customer_edit_logs`
--
ALTER TABLE `customer_edit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cel_user` (`edited_by`),
  ADD KEY `idx_cel_customer` (`customer_id`);

--
-- Indexes for table `customer_files`
--
ALTER TABLE `customer_files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cf_user` (`uploaded_by`),
  ADD KEY `idx_cf_customer` (`customer_id`);

--
-- Indexes for table `inventory`
--
ALTER TABLE `inventory`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_store_sku` (`store`,`sku`),
  ADD KEY `idx_sku` (`sku`),
  ADD KEY `idx_on_hand` (`on_hand`),
  ADD KEY `idx_vendor` (`vendor`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_number` (`invoice_number`),
  ADD KEY `fk_inv_user` (`generated_by`),
  ADD KEY `idx_inv_po` (`po_id`);

--
-- Indexes for table `invoice_logs`
--
ALTER TABLE `invoice_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_il_invoice` (`invoice_id`),
  ADD KEY `idx_il_user` (`user_id`),
  ADD KEY `idx_il_created` (`created_at`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pay_user` (`recorded_by`),
  ADD KEY `idx_pay_po` (`po_id`);

--
-- Indexes for table `po_edit_logs`
--
ALTER TABLE `po_edit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pel_user` (`edited_by`),
  ADD KEY `idx_pel_po` (`po_id`);

--
-- Indexes for table `po_items`
--
ALTER TABLE `po_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_items_po` (`po_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_store_sku` (`store`,`sku`),
  ADD KEY `idx_sku` (`sku`),
  ADD KEY `idx_dept` (`dept`),
  ADD KEY `idx_vendor` (`vendor`);
ALTER TABLE `products` ADD FULLTEXT KEY `ft_sku_desc` (`sku`,`description`);

--
-- Indexes for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `po_number` (`po_number`),
  ADD KEY `fk_po_user` (`created_by`),
  ADD KEY `idx_po_customer` (`customer_id`),
  ADD KEY `idx_po_status` (`status`),
  ADD KEY `idx_po_payment_status` (`payment_status`);

--
-- Indexes for table `quotations`
--
ALTER TABLE `quotations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `quote_number` (`quote_number`),
  ADD UNIQUE KEY `po_id` (`po_id`);

--
-- Indexes for table `temp_credit_limits`
--
ALTER TABLE `temp_credit_limits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_tcl_user` (`created_by`),
  ADD KEY `idx_tcl_customer` (`customer_id`);

--
-- Indexes for table `temp_role_grants`
--
ALTER TABLE `temp_role_grants`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_trg_granter` (`granted_by`),
  ADD KEY `idx_trg_user` (`user_id`),
  ADD KEY `idx_trg_expires` (`expires_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `billing_notes`
--
ALTER TABLE `billing_notes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `billing_note_items`
--
ALTER TABLE `billing_note_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `credit_limit_adjustments`
--
ALTER TABLE `credit_limit_adjustments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `credit_limit_requests`
--
ALTER TABLE `credit_limit_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `credit_notes`
--
ALTER TABLE `credit_notes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `credit_note_items`
--
ALTER TABLE `credit_note_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `credit_note_logs`
--
ALTER TABLE `credit_note_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_credit_notes`
--
ALTER TABLE `customer_credit_notes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_credit_note_usages`
--
ALTER TABLE `customer_credit_note_usages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_edit_logs`
--
ALTER TABLE `customer_edit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_files`
--
ALTER TABLE `customer_files`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory`
--
ALTER TABLE `inventory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invoice_logs`
--
ALTER TABLE `invoice_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `po_edit_logs`
--
ALTER TABLE `po_edit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `po_items`
--
ALTER TABLE `po_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `quotations`
--
ALTER TABLE `quotations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `temp_credit_limits`
--
ALTER TABLE `temp_credit_limits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `temp_role_grants`
--
ALTER TABLE `temp_role_grants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `billing_notes`
--
ALTER TABLE `billing_notes`
  ADD CONSTRAINT `billing_notes_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `billing_notes_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `billing_note_items`
--
ALTER TABLE `billing_note_items`
  ADD CONSTRAINT `billing_note_items_ibfk_1` FOREIGN KEY (`billing_note_id`) REFERENCES `billing_notes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `billing_note_items_ibfk_2` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`);

--
-- Constraints for table `credit_limit_adjustments`
--
ALTER TABLE `credit_limit_adjustments`
  ADD CONSTRAINT `fk_cla_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cla_user` FOREIGN KEY (`adjusted_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `credit_limit_requests`
--
ALTER TABLE `credit_limit_requests`
  ADD CONSTRAINT `fk_clr_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_clr_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_clr_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `credit_notes`
--
ALTER TABLE `credit_notes`
  ADD CONSTRAINT `fk_cn_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_cn_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`),
  ADD CONSTRAINT `fk_cn_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `credit_note_items`
--
ALTER TABLE `credit_note_items`
  ADD CONSTRAINT `fk_cni_cn` FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cni_poitem` FOREIGN KEY (`po_item_id`) REFERENCES `po_items` (`id`);

--
-- Constraints for table `credit_note_logs`
--
ALTER TABLE `credit_note_logs`
  ADD CONSTRAINT `fk_cnl_cn` FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cnl_user` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `customer_credit_notes`
--
ALTER TABLE `customer_credit_notes`
  ADD CONSTRAINT `fk_ccn_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ccn_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ccn_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`),
  ADD CONSTRAINT `fk_ccn_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `customer_credit_note_usages`
--
ALTER TABLE `customer_credit_note_usages`
  ADD CONSTRAINT `fk_ccnu_ccn` FOREIGN KEY (`ccn_id`) REFERENCES `customer_credit_notes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ccnu_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ccnu_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `customer_edit_logs`
--
ALTER TABLE `customer_edit_logs`
  ADD CONSTRAINT `fk_cel_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cel_user` FOREIGN KEY (`edited_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `customer_files`
--
ALTER TABLE `customer_files`
  ADD CONSTRAINT `fk_cf_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cf_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `fk_inv_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_inv_user` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `invoice_logs`
--
ALTER TABLE `invoice_logs`
  ADD CONSTRAINT `fk_il_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_il_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_pay_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pay_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `po_edit_logs`
--
ALTER TABLE `po_edit_logs`
  ADD CONSTRAINT `fk_pel_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pel_user` FOREIGN KEY (`edited_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `po_items`
--
ALTER TABLE `po_items`
  ADD CONSTRAINT `fk_items_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD CONSTRAINT `fk_po_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_po_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `quotations`
--
ALTER TABLE `quotations`
  ADD CONSTRAINT `fk_qt_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `temp_credit_limits`
--
ALTER TABLE `temp_credit_limits`
  ADD CONSTRAINT `fk_tcl_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_tcl_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `temp_role_grants`
--
ALTER TABLE `temp_role_grants`
  ADD CONSTRAINT `fk_trg_granter` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_trg_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
