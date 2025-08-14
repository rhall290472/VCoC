-- phpMyAdmin SQL Dump
-- version 4.8.5
-- https://www.phpmyadmin.net/
--
-- Host: custsql-ipg99.eigbox.net
-- Generation Time: Aug 13, 2025 at 11:53 PM
-- Server version: 5.6.51-91.0-log
-- PHP Version: 7.0.33-0ubuntu0.16.04.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `usas`
--

-- --------------------------------------------------------

--
-- Table structure for table `teams`
--

CREATE TABLE `teams` (
  `Idx` int(11) NOT NULL,
  `code` text,
  `fullname` text,
  `TeamType` text,
  `Zone` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `teams`
--

INSERT INTO `teams` (`Idx`, `code`, `fullname`, `TeamType`, `Zone`) VALUES
(1, 'AAC', 'Aspire Aquatics of Colorado', 'Year Round', 2),
(2, 'ACES', 'Aces Swim Club', 'Year Round', 2),
(3, 'AQUA', 'Aquawolves Swimming', 'Year Round', 2),
(4, 'ASP', 'Aspen Swim Club', 'Year Round', 4),
(5, 'AVON', 'Avon Swim Club', 'Year Round', 4),
(6, 'BB', 'Brighton Bullfrogs', 'Year Round', 1),
(7, 'BLDR', 'Boulder Swimming', 'Year Round', 2),
(8, 'BURE', 'Bure-Aqua', 'Year Round', 2),
(9, 'CAC', 'Colorado Athletic Club', 'Year Round', 2),
(10, 'CBL', 'Colorado Blue', 'Year Round', 2),
(11, 'COSA', 'Colorado Springs Area Swimming', 'Year Round', 5),
(12, 'CT', 'Colorado Torpedoes', 'Year Round', 5),
(13, 'CUDA', 'Front Range Barracudas', 'Year Round', 1),
(14, 'DAC', 'The Denver Athletic Club', 'Year Round', 2),
(15, 'DOGS', 'Swim Dogs', 'Year Round', 2),
(16, 'DSA', 'Denver Swim Academy', 'Year Round', 2),
(17, 'DTST', 'Denver Triton Swim Team', 'Year Round', 2),
(18, 'EA', 'Elevation Athletics', 'Year Round', 2),
(19, 'EVER', 'Evergreen Swim Team', 'Year Round', 2),
(20, 'FAC', 'Flatiron Athletic Club', 'Year Round', 2),
(21, 'FAST', 'Fort Collins Area Swim Team', 'Year Round', 1),
(22, 'FLFN', 'Falfins Swimming', 'Year Round', 5),
(23, 'FORM', 'FORM Swim Team', 'Year Round', 2),
(24, 'FST', 'Foothills Swim Team', 'Year Round', 2),
(25, 'GTS', 'Greenwood Tiger Sharks', 'Year Round', 2),
(26, 'HRA', 'Highlands Ranch Aquatics', 'Year Round', 2),
(27, 'KNGT', 'Full Armour Swim Team', 'Year Round', 5),
(28, 'LIFE', 'Life Time Colorado Swim Team', 'Year Round', 2),
(29, 'LIFE', 'Life Time Colorado Swim Team', 'Year Round', 5),
(30, 'LONG', 'Longmont Swim Club', 'Year Round', 1),
(31, 'LOVE', 'Loveland Swim Club', 'Year Round', 1),
(32, 'MACS', 'Mission Aurora Colorado Swimming', 'Year Round', 2),
(33, 'MAVS', 'Maverick Aquatics', 'Year Round', 4),
(34, 'MM', 'Montrose Marlins Swim Club', 'Year Round', 4),
(35, 'MVPA', 'Mountain Valley Performance Academy', 'Year Round', 3),
(36, 'NFSC', 'Northglenn Fusion Swim Club', 'Year Round', 2),
(37, 'NJ', 'North Jeffco Swim Team', 'Year Round', 2),
(38, 'NOCO', 'Northern Colorado Swim Club', 'Year Round', 1),
(39, 'PARK', 'Parker Phenomena', 'Year Round', 2),
(40, 'PCST', 'Pueblo County Swim Team', 'Year Round', 5),
(41, 'PEAK', 'PEAK Swim Team', 'Year Round', 5),
(42, 'PPA', 'Pikes Peak Athletics', 'Year Round', 5),
(43, 'PSC', 'Pueblo Swim Club', 'Year Round', 3),
(44, 'RF', 'Rocky Ford Blue Marlins', 'Year Round', 3),
(45, 'RIP', 'Riptide CAC Boulder', 'Year Round', 2),
(46, 'ROCK', 'Castle Rock Swimming', 'Year Round', 2),
(47, 'RPDS', 'Rocky Mountain Rapids', 'Year Round', 5),
(48, 'SOPR', 'Team Sopris Swimming', 'Year Round', 4),
(49, 'SSA', 'SlipStream Aquatics', 'Year Round', 2),
(50, 'SSST', 'Steamboat Springs Swim Team', 'Year Round', 4),
(51, 'TOPS', 'University of Denver Hilltoppers', 'Year Round', 2),
(52, 'TSC', 'Silverthorne Tsunami Swim Club', 'Year Round', 4),
(53, 'USAR', 'Paralympic Resident Team', 'Year Round', 5),
(54, 'VOTX', 'Team Vortex', 'Year Round', 1),
(55, 'WAVE', 'Eaton Red Waves', 'Year Round', 1),
(56, 'WTST', 'Woodmoor Tsunamis Swim Team', 'Year Round', 5),
(57, 'YWSC', 'YMCA/Wahoos Swim Team', 'Year Round', 1),
(58, 'UN', 'Unattached-1', 'Year Round', 1),
(60, 'UN', 'Unattached-2', 'Year Round', 2),
(61, 'UN', 'Unattached-3', 'Year Round', 3),
(62, 'UN', 'Unattached-4', 'Year Round', 4),
(63, 'UN', 'Unattached-5', 'Year Round', 5);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `teams`
--
ALTER TABLE `teams`
  ADD PRIMARY KEY (`Idx`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `teams`
--
ALTER TABLE `teams`
  MODIFY `Idx` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
