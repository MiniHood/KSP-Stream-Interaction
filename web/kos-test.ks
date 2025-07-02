// kOS TCP Test Script
// Save this as kos-test.ks and run it on a CPU

// Set up TCP connection
SET TCP TO TCPCONNECTION("127.0.0.1", 5410).

// Wait for connection
UNTIL TCP:CONNECTED {
    PRINT "Waiting for TCP connection...".
    WAIT 1.
}

PRINT "TCP Connected!".

// Listen for incoming messages
UNTIL FALSE {
    IF TCP:DATA:AVAILABLE {
        LOCAL MESSAGE IS TCP:READLINE().
        PRINT "Received: " + MESSAGE.
        
        // Echo back to confirm receipt
        TCP:WRITELINE("kOS received: " + MESSAGE).
    }
    
    WAIT 0.1.
} 