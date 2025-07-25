// IPアドレス生成のためのヘルパー関数 (グローバルスコープ)
function generateRandomIp() {
    return Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.');
}

document.addEventListener('DOMContentLoaded', () => {
    const currentConnectionSpan = document.getElementById('current-connection');
    const connectFreeWifiBtn = document.getElementById('connect-free-wifi');
    const connectHomeWifiBtn = document.getElementById('connect-home-wifi');
    const toggleVpnBtn = document.getElementById('toggle-vpn');

    const loginHttpBtn = document.getElementById('login-http-btn');
    const loginHttpsBtn = document.getElementById('login-https-btn');
    const purchaseHttpBtn = document.getElementById('purchase-http-btn');
    const purchaseHttpsBtn = document.getElementById('purchase-https-btn');

    const usernameInput = document.getElementById('un-input');
    const passwordInput = document.getElementById('ps-input');
    const ccInput = document.getElementById('cc-input');
    const cvvInput = document.getElementById('cvv-input');

    const filterInput = document.getElementById('filter-input');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const clearFilterBtn = document.getElementById('clear-filter-btn');
    const packetLogElement = document.getElementById('packet-log');
    const messageArea = document.getElementById('message-area');
    const resetButton = document.getElementById('reset-button');

    // 状態変数
    let connection = {
        type: 'free-unencrypted', // 'free-unencrypted', 'home-encrypted'
        vpnActive: false
    };

    const userActionsData = {
        'login-http': {
            protocol: 'HTTP', dest: 'login.bank.com', content: (u, p) => `GET /auth HTTP/1.1\nHost: login.bank.com\n\nUser-Agent: ...\n\nusername=${u}&password=${p}`, content_plain: (u, p) => `user:${u}, pass:${p}`, sensitive: true, type: 'login'
        },
        'login-https': {
            protocol: 'HTTPS', dest: 'login.bank.com', content: '[Encrypted Login Data]', sensitive: true, type: 'login'
        },
        'purchase-http': {
            protocol: 'HTTP', dest: 'shop.buyit.com', content: (cc, cvv) => `POST /checkout HTTP/1.1\nHost: shop.buyit.com\n\nCard=${cc}&CVV=${cvv}`, content_plain: (cc, cvv) => `CC:${cc}, CVV:${cvv}`, sensitive: true, type: 'cc'
        },
        'purchase-https': {
            protocol: 'HTTPS', dest: 'shop.buyit.com', content: '[Encrypted Credit Card Data]', sensitive: true, type: 'cc'
        }
    };

    let allLogs = []; // フィルター適用前の全ログ

    // UI更新関数
    function updateUI() {
        let connText = '';
        currentConnectionSpan.classList.remove('unencrypted', 'vpn-active');
        if (connection.vpnActive) {
            connText = 'VPN接続中';
            currentConnectionSpan.classList.add('vpn-active');
        } else if (connection.type === 'free-unencrypted') {
            connText = 'Free Wi-Fi (暗号化なし)';
            currentConnectionSpan.classList.add('unencrypted');
        } else {
            connText = '自宅Wi-Fi (暗号化あり)';
        }
        currentConnectionSpan.textContent = connText;

        document.querySelectorAll('.conn-btn').forEach(btn => btn.classList.remove('active'));
        if (connection.type === 'free-unencrypted' && !connection.vpnActive) {
            connectFreeWifiBtn.classList.add('active');
        } else if (connection.type === 'home-encrypted' && !connection.vpnActive) {
            connectHomeWifiBtn.classList.add('active');
        }
        if (connection.vpnActive) {
            toggleVpnBtn.classList.add('active');
        } else {
            toggleVpnBtn.classList.remove('active');
        }
    }

    // パケットログの追加
    function addPacketLog(packet) {
        allLogs.unshift(packet); // ★修正：新しいログを常に先頭に追加
        if (allLogs.length > 100) allLogs.pop(); // ログが多すぎたら古いものを削除
        renderPacketLog(); // ログ表示を更新
    }

    // パケットログのレンダリング (フィルター適用)
    function renderPacketLog() {
        packetLogElement.innerHTML = ''; // 全体をクリアして再描画
        const filterText = filterInput.value.toLowerCase();
        
        let latestLogMessage = '操作を開始してください。'; // メッセージエリアの初期値
        let latestMessageColor = '#856404'; // メッセージ色の初期値

        const logsToRender = allLogs.filter(log => {
            const logString = `${log.time} ${log.sourceIp} ${log.destIp} ${log.protocol} ${log.content} ${log.content_plain}`.toLowerCase();
            return logString.includes(filterText);
        });

        logsToRender.forEach(log => { // filteredLogsは定義されていないので、logsToRenderを使用
            const logEntry = document.createElement('div');
            logEntry.classList.add('log-entry');

            let contentDisplay = '';
            let messageForThisLog = ''; // このログ専用のメッセージ

            // VPNがアクティブな場合、すべてのログコンテンツをVPNトンネルとして表示
            if (log.vpnActive) {
                contentDisplay = `<span class="log-protocol">VPN(OpenVPN Data)</span>: <span class="log-vpn-encrypted">[Encrypted Tunnel]</span> <span class="log-hidden-info">(アクセス先IP: ${log.destIp})</span>`;
                messageForThisLog = `VPN接続中：あなたの通信は強固に暗号化され、アクセス先も秘匿されています！`;
                messageColor = '#6f42c1';
            } 
            // HTTPS通信の場合
            else if (log.protocol === 'HTTPS') {
                contentDisplay = `<span class="log-protocol">HTTPS(TLSv1.2)</span>: <span class="log-content">[Encrypted Application Data]</span>`;
                messageForThisLog = `通信は暗号化されているため安全です。`;
                messageColor = '#28a745';
            } 
            // 非暗号化Free Wi-Fiかつ機密情報の場合
            else if (log.sensitive && !log.vpnActive && log.connectionType === 'free-unencrypted') {
                contentDisplay = `<span class="log-protocol">HTTP</span>: <span class="log-highlight">${log.content_plain}</span>`;
                if (log.type === 'login') messageForThisLog = `警告！Free Wi-Fi (暗号化なし) でログイン情報が盗聴されました: ${log.content_plain}`;
                if (log.type === 'cc') messageForThisLog = `警告！Free Wi-Fi (暗号化なし) でクレジットカード情報が盗聴されました: ${log.content_plain}`;
                messageColor = '#dc3545';
            } 
            // 暗号化Wi-FiでもHTTP通信かつ機密情報の場合
            else if (log.sensitive && !log.vpnActive && log.connectionType === 'home-encrypted' && log.protocol === 'HTTP') {
                 contentDisplay = `<span class="log-protocol">HTTP</span>: <span class="log-highlight">${log.content_plain}</span>`;
                 messageForThisLog = `警告！暗号化Wi-FiでもHTTP通信は丸見えです！: ${log.content_plain}`;
                 messageColor = '#dc3545';
            }
            else { // その他の一般通信
                contentDisplay = `<span class="log-protocol">${log.protocol}</span>: <span class="log-content">${log.content}</span>`;
                messageForThisLog = '操作を開始してください。'; // デフォルトの操作ガイダンス
                messageColor = '#856404';
            }

            // メッセージエリアはループ内で更新せず、後で最新のものを設定する
            // latestLogMessage = messageForThisLog; // これを最終メッセージにする
            // latestMessageColor = messageColor;

            logEntry.innerHTML = `
                <div>
                  <span class="log-time">[${log.time}]</span>
                  <span class="log-source">${log.sourceIp}</span> ->
                  <span class="log-dest">${log.destIp}</span>
                </div>
                ${contentDisplay}
            `;
            packetLogElement.appendChild(logEntry); // ★修正：常に下に追加 (フィルタリングされたリスト順)
        });

        // フィルター後のログリストの先頭（最新）のメッセージをmessageAreaに設定
        if (logsToRender.length > 0) {
            const latestLog = logsToRender[0]; // allLogsはunshiftしているので、filteredLogsの先頭が最新
             if (latestLog.vpnActive) {
                latestLogMessage = `VPN接続中：あなたの通信は強固に暗号化され、アクセス先も秘匿されています！`;
                latestMessageColor = '#6f42c1';
            } else if (latestLog.protocol === 'HTTPS') {
                latestLogMessage = `通信は暗号化されているため安全です。`;
                latestMessageColor = '#28a745';
            } else if (latestLog.sensitive && !latestLog.vpnActive && latestLog.connectionType === 'free-unencrypted') {
                latestLogMessage = `警告！Free Wi-Fi (暗号化なし) で${latestLog.type === 'login' ? 'ログイン情報' : 'クレジットカード情報'}が盗聴されました: ${latestLog.content_plain}`;
                latestMessageColor = '#dc3545';
            } else if (latestLog.sensitive && !latestLog.vpnActive && latestLog.connectionType === 'home-encrypted' && latestLog.protocol === 'HTTP') {
                latestLogMessage = `警告！暗号化Wi-FiでもHTTP通信は丸見えです！: ${latestLog.content_plain}`;
                latestMessageColor = '#dc3545';
            } else {
                latestLogMessage = '操作を開始してください。';
                latestMessageColor = '#856404';
            }
        } else {
            latestLogMessage = '表示するパケットがありません。'; // フィルターで何も表示されない場合
            latestMessageColor = '#856404';
        }


        messageArea.textContent = latestLogMessage; // ループの外で最終メッセージを設定
        messageArea.style.color = latestMessageColor; // 色も設定
        
        packetLogElement.scrollTop = 0; // ★修正：スクロール位置を常に最上部にする
    }

    // パケットを生成してログに追加する汎用関数
    function sendPacket(actionType) {
        const actionInfo = userActionsData[actionType];
        
        let content = '';
        let isSensitive = false;
        let contentPlain = '';
        let type = actionInfo.type;

        // VPNがアクティブな場合は常に暗号化済みとして扱う
        if (connection.vpnActive) {
            content = `[VPN Encrypted Tunnel]`;
            isSensitive = false;
        } else if (actionInfo.protocol === 'HTTPS') {
            content = '[Encrypted Data]';
            isSensitive = false;
        } else { // HTTP (平文)
            isSensitive = actionInfo.sensitive;
            if (actionInfo.type === 'login') {
                const u = usernameInput.value || 'testuser';
                const p = passwordInput.value || 'password123';
                contentPlain = `user:${u}, pass:${p}`;
                content = actionInfo.content(u, p);
            } else if (actionInfo.type === 'cc') {
                const cc = ccInput.value || '1234-...';
                const cvv = cvvInput.value || '123';
                contentPlain = `CC:${cc}, CVV:${cvv}`;
                content = actionInfo.content(cc, cvv);
            } else {
                content = actionInfo.content();
            }
        }

        const newPacket = {
            time: new Date().toLocaleTimeString(),
            sourceIp: generateRandomIp(),
            destIp: connection.vpnActive ? generateRandomIp() : actionInfo.dest, 
            protocol: actionInfo.protocol,
            content: content,
            content_plain: contentPlain,
            sensitive: isSensitive,
            type: type,
            vpnActive: connection.vpnActive,
            connectionType: connection.type
        };
        addPacketLog(newPacket);
    }

    // イベントリスナー設定
    connectFreeWifiBtn.addEventListener('click', () => {
        connection.type = 'free-unencrypted';
        connection.vpnActive = false;
        updateUI();
        messageArea.textContent = 'Free Wi-Fi (暗号化なし) に接続しました。';
    });

    connectHomeWifiBtn.addEventListener('click', () => {
        connection.type = 'home-encrypted';
        connection.vpnActive = false;
        updateUI();
        messageArea.textContent = '自宅Wi-Fi (暗号化あり) に接続しました。';
    });

    toggleVpnBtn.addEventListener('click', () => {
        connection.vpnActive = !connection.vpnActive;
        updateUI();
        if (connection.vpnActive) {
            messageArea.textContent = 'VPNをONにしました。通信が保護されます。';
        } else {
            messageArea.textContent = 'VPNをOFFにしました。';
        }
    });

    loginHttpBtn.addEventListener('click', () => sendPacket('login-http'));
    loginHttpsBtn.addEventListener('click', () => sendPacket('login-https'));
    purchaseHttpBtn.addEventListener('click', () => sendPacket('purchase-http'));
    purchaseHttpsBtn.addEventListener('click', () => sendPacket('purchase-https'));

    applyFilterBtn.addEventListener('click', renderPacketLog);
    clearFilterBtn.addEventListener('click', () => {
        filterInput.value = '';
        renderPacketLog();
    });

    resetButton.addEventListener('click', () => {
        allLogs = [];
        usernameInput.value = '';
        passwordInput.value = '';
        ccInput.value = '';
        cvvInput.value = '';
        filterInput.value = '';
        initGame();
    });

    // 初期化処理
    function initGame() {
        connection.type = 'free-unencrypted';
        connection.vpnActive = false;
        allLogs = [];
        usernameInput.value = '';
        passwordInput.value = '';
        ccInput.value = '';
        cvvInput.value = '';
        filterInput.value = '';
        messageArea.textContent = '操作を開始してください。';
        messageArea.style.color = '#856404';

        updateUI();
        renderPacketLog();
    }

    initGame();
});