// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract MaliciousBenchmarkTarget {
    error RevertOnFallback();

    fallback() external payable {
        revert RevertOnFallback();
    }
}
