use alloy::sol;

// ERC20 interface
sol! {
    #[sol(rpc)]
    interface IERC20 {
        function name() external view returns (string);
        function symbol() external view returns (string);
        function decimals() external view returns (uint8);
        function totalSupply() external view returns (uint256);
        function balanceOf(address account) external view returns (uint256);
        function transfer(address to, uint256 amount) external returns (bool);
        function allowance(address owner, address spender) external view returns (uint256);
        function approve(address spender, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
    }
}

// MockERC20 interface (mintable)
sol! {
    #[sol(rpc)]
    interface IMockERC20 {
        function mint(address to, uint256 amount) external;
        function burn(address from, uint256 amount) external;
    }
}

// Input Settler Escrow interface
sol! {
    #[sol(rpc)]
    interface IInputSettlerEscrow {
        struct StandardOrder {
            address user;
            uint64 nonce;
            uint64 originChainId;
            uint32 openDeadline;
            uint32 fillDeadline;
            bytes32 orderDataType;
            bytes orderData;
        }

        struct Input {
            address token;
            uint256 amount;
        }

        struct Output {
            bytes32 token;
            uint256 amount;
            bytes32 recipient;
            uint64 chainId;
        }

        function open(StandardOrder calldata order) external;
        function fill(bytes32 orderId, bytes calldata originData, bytes calldata fillerData) external;
        function claim(bytes32[] calldata orderIds) external;
    }
}

// Output Settler Simple interface
sol! {
    #[sol(rpc)]
    interface IOutputSettlerSimple {
        function fill(bytes32 orderId, bytes calldata originData, bytes calldata fillerData) external;
    }
}

// Oracle interface
sol! {
    #[sol(rpc)]
    interface IOracle {
        function verifyFillProof(bytes32 orderId, bytes calldata proof) external view returns (bool);
    }
}
