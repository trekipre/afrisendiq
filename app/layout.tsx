import React from 'react';

export default function Layout({ children }) {
    return (
        <div>
            <head>
                <title>AfriSendIQ</title>
                <meta name="description" content="AfriSendIQ" />
                <link rel="icon" href="/logos/AfriSendIQ Logo.png" />
                <link rel="apple-touch-icon" href="/logos/AfriSendIQ Logo.png" />
            </head>
            {children}
        </div>
    );
}