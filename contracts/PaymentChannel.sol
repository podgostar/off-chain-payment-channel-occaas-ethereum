// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Error list
error NotInvited(address sender);
error AlreadyPartOfChannel(address sender);
error CloseNoSignatureStakeholder();
error NotPartOfChannel(address sender);
error AlreadyInvited(address invitee);

/**
 *@title Factory contract for creating new payment channels
 */
contract PaymentChannel is Ownable {
    // event list
    event OpenChannelEvent(
        string indexed _channelID,
        bytes open_token
    );

    // action: OPEN, JOIN, TX, LEAVE (uint8 - 1, 2 ,3, 4)

    event JoinChannelEvent(
        string indexed _channelID,
        bytes join_token
    );

    event LeaveChannelEvent(
        string indexed _channelID,
        bytes leave_token
    );

    // import SafeMath lib for uint operations
    using SafeMath for uint256;
    using ECDSA for *;

    // enum list
    enum Channel_Status {
        UNDEFINED,
        OPENED,
        CLOSED
    } // 0 = UNDEFINED; 1 = OPENED; 2 = CLOSED
    enum Stakeholder_Status {
        UNDEFINED,
        INVITED,
        ACTIVE
    } // 0 = UNDEFINED; 1 = INVITED; 2 = ACTIVE;

    // Channel struct
    struct Channel {
        address _oracleAddress; // address of oracle
        mapping(address => Stakeholder) _stakeholders; // address of stakeholder ponts to struct of Stakeholder
        Channel_Status _current_status; // current state of channel
        uint256 _number_of_stakeholders; // number of channel stakeholders
    }

    struct Stakeholder {
        uint256 _balance; // balance of stakeholder
        Stakeholder_Status _status; // stakeholder status
    }

    struct State {
        address _address;
        uint256 _balance;
    }

    // name of the channel points to Cahnnel
    mapping(string => Channel) public channel_list;
    // list of payment channel oracles
    mapping(address => bool) public oracle_list;

    function openChannel(
        bytes calldata open_token,
        address[] calldata invited_list
    ) public payable {
        // Decode open_token
        (
            bytes memory _open_token_data,
            ,
            bytes memory _sender_sig,
            bytes memory _oracle_sig
        ) = abi.decode(open_token, (bytes, string, bytes, bytes));

        (
            uint8  _action,
            string memory _channel_id,
            State[] memory _state,
            address _sender
        ) = abi.decode(_open_token_data, (uint8, string, State[], address));

        require(_action == 1, "Action type defined within token is wrong");

        // Create object of _temp_channel
        Channel storage _temp_channel = channel_list[_channel_id];

        // Check if the channel with provided name does not exist already
        require(
            _temp_channel._current_status == Channel_Status.UNDEFINED,
            "Channel with provided name/channel id already exist"
        );

        // Validate signature of sender
        bytes32 _contentHash = ECDSA.toEthSignedMessageHash(_open_token_data);
        require(_sender == ECDSA.recover(_contentHash, _sender_sig));
        // Validate sender provided in encoded data is equal to msg.sender
        require(_sender == msg.sender);

        // Validate signature of oracle
        address _oracleAddress = ECDSA.recover(ECDSA.toEthSignedMessageHash(_open_token_data), _oracle_sig);

        // Aforementioned channel id must be signed by one of the oracle's that are on list
        require(
            oracle_list[_oracleAddress] == true,
            "Oracle that signed open_token is not authorized"
        );

        // Currently stakeholder that open payment channel can invite max. 4 other stakeholders
        require(
            invited_list.length < 4,
            "Number of invited stakeholders is too high (Max. 4)"
        );

        require(
            _state[0]._balance == msg.value &&  msg.value > 0,
            "Amount of crypto defined within open_token is not the same as provided (msg. value) or msg.value !>0"
        );

        // Assign values
        _temp_channel._stakeholders[_sender] = Stakeholder(
            msg.value, // 
            Stakeholder_Status.ACTIVE
        );
        _temp_channel._oracleAddress = _oracleAddress;
        _temp_channel._number_of_stakeholders++;
        _temp_channel._current_status = Channel_Status.OPENED;

        // Assign invited list
        for (uint256 i = 0; i < invited_list.length; i++) {
            _temp_channel._stakeholders[invited_list[i]] = Stakeholder(
                0, // balance
                Stakeholder_Status.INVITED // status
            );
        }

        emit OpenChannelEvent(_channel_id, open_token);
    }

    function getStakeholder(string calldata channel_id, address stakeholder)
        public
        view
        returns (Stakeholder memory)
    {
        Channel storage _temp_channel = channel_list[channel_id];
        return _temp_channel._stakeholders[stakeholder];
    }

    function joinChannel(bytes calldata join_token) external payable {
       
        // Decode join_token
        (
            bytes memory _join_token_data,
            ,
            bytes memory _sender_sig,
            bytes memory _oracle_sig
        ) = abi.decode(join_token, (bytes, string, bytes, bytes));

        (
            uint8  _action,
            string memory _channel_id,
            State[] memory _state,
            address _sender
        ) = abi.decode(_join_token_data, (uint8, string, State[], address));

        require(_action == 2, "Action type defined within token is wrong"); // 2 = join

        // Validate signature of sender
        bytes32 _contentHash = ECDSA.toEthSignedMessageHash(_join_token_data);
        require(_sender == ECDSA.recover(_contentHash, _sender_sig));
        // Validate sender provided in encoded data is equal to msg.sender
        require(_sender == msg.sender);

        // Validate signature of oracle
        address _oracleAddress = ECDSA.recover(ECDSA.toEthSignedMessageHash(_join_token_data), _oracle_sig);

        // Aforementioned channel id must be signed by one of the oracle's that are on list
        require(
            oracle_list[_oracleAddress] == true,
            "Oracle that signed open_token is not authorized"
        );

        Channel storage _temp_channel = channel_list[_channel_id];
        
        require(
            _temp_channel._current_status == Channel_Status.OPENED,
            "Channel with provided channel id is not opened"
        );

        require(
            _temp_channel._stakeholders[_sender]._status ==
                Stakeholder_Status.INVITED && _temp_channel._stakeholders[_sender]._balance == 0,
            "Stakeholder is not invited to this channel or Stakeholder already joined this channel"
        );

        require(
            _state[0]._balance == msg.value &&  msg.value > 0,
            "Amount of crypto defined within open_token is not the same as provided (msg. value) or msg.value !>0"
        );

        // Assign values to stakeholder who is joining
        _temp_channel._number_of_stakeholders++;
        _temp_channel._stakeholders[_sender] = Stakeholder(
            msg.value, // balance
            Stakeholder_Status.ACTIVE // status
        );

        // To be "catched" by the oracle
        emit JoinChannelEvent(_channel_id, join_token);
    }

    function invite(string calldata _channel_id, address _invitee) external {
        // find channel
        Channel storage _temp_channel = channel_list[_channel_id];

        // check that channel is opened
        require(
            _temp_channel._current_status == Channel_Status.OPENED,
            "Channel is not opened"
        );

        // stakeholder must be active
        require(
            _temp_channel._stakeholders[msg.sender]._status ==
                Stakeholder_Status.ACTIVE,
            "Stakeholder who is inviting is not active"
        );

        // validacija vhodnih podatkov
        require(_invitee != 0x0000000000000000000000000000000000000000, "Wrong address");
        require(
            _temp_channel._stakeholders[_invitee]._status ==
                Stakeholder_Status.UNDEFINED,
                "Invitee was already invited or active within this channel"
        );

        // assign values
        _temp_channel._stakeholders[_invitee] = Stakeholder(
            0,
            Stakeholder_Status.INVITED
        );
    }

    function modify_oracle(address oracle, bool oracle_status)
        public
        onlyOwner
    {
        oracle_list[oracle] = oracle_status;
    }

    function leaveChannel(bytes calldata leave_token) external {
        // Decode leave_token
        (
            bytes memory _leave_token_data,
            ,
            bytes memory _sender_sig,
            bytes memory _oracle_sig
        ) = abi.decode(leave_token, (bytes, string, bytes, bytes));

        (
            uint8  _action,
            string memory _channel_id,
            State[] memory _state,
            address _sender
        ) = abi.decode(_leave_token_data, (uint8, string, State[], address));

        require(_action == 4, "Action type defined within token is wrong"); // 4 = join

        // Validate signature of sender
        bytes32 _contentHash = ECDSA.toEthSignedMessageHash(_leave_token_data);
        require(_sender == ECDSA.recover(_contentHash, _sender_sig));
        // Validate sender provided in encoded data is equal to msg.sender
        require(_sender == msg.sender);

        // Validate signature of oracle
        address _oracleAddress = ECDSA.recover(ECDSA.toEthSignedMessageHash(_leave_token_data), _oracle_sig);

        // Aforementioned channel id must be signed by one of the oracle's that are on list
        require(
            oracle_list[_oracleAddress] == true,
            "Oracle that signed open_token is not authorized"
        );

        Channel storage _temp_channel = channel_list[_channel_id];
        
        require(
            _temp_channel._current_status == Channel_Status.OPENED,
            "Channel with provided channel id is not opened"
        );

        // assign values
        _temp_channel._number_of_stakeholders--;
        _temp_channel._stakeholders[_sender]._status = Stakeholder_Status.UNDEFINED;
        _temp_channel._stakeholders[_sender]._balance = 0;
        payable(_sender).transfer(_state[0]._balance);

        emit LeaveChannelEvent(_channel_id, leave_token);
    }

}
