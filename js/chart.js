// ============================================================
// chart.js - 统计趋势图（Canvas 零依赖实现）
// 每日答题数 + 正确率折线图
// ============================================================
var App = window.App || {};
(function(A) {
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            this.beginPath();
            this.moveTo(x + r, y);
            this.arcTo(x + w, y, x + w, y + h, r);
            this.arcTo(x + w, y + h, x, y + h, r);
            this.arcTo(x, y + h, x, y, r);
            this.arcTo(x, y, x + w, y, r);
            this.closePath();
            return this;
        };
    }
    function renderTrendChart(canvasId, history) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var w = canvas.parentElement.clientWidth - 4;
        var h = 180;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        // 按天聚合最近 14 天数据
        var days = 14;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var dayData = [];
        for (var i = days - 1; i >= 0; i--) {
            var dayStart = today.getTime() - i * 86400000;
            var dayEnd = dayStart + 86400000;
            var dayCount = 0;
            var dayCorrect = 0;
            for (var j = 0; j < history.length; j++) {
                if (history[j].time >= dayStart && history[j].time < dayEnd) {
                    dayCount++;
                    if (history[j].ok) dayCorrect++;
                }
            }
            dayData.push({
                date: new Date(dayStart),
                count: dayCount,
                correct: dayCorrect,
                acc: dayCount > 0 ? Math.round(dayCorrect / dayCount * 100) : 0
            });
        }

        // 找最大值
        var maxCount = 0;
        for (var k = 0; k < dayData.length; k++) {
            if (dayData[k].count > maxCount) maxCount = dayData[k].count;
        }
        if (maxCount === 0) maxCount = 1;

        // 绘图参数
        var padL = 30, padR = 35, padT = 20, padB = 30;
        var chartW = w - padL - padR;
        var chartH = h - padT - padB;
        var stepX = chartW / (days - 1);

        // --- 背景网格 ---
        ctx.strokeStyle = 'rgba(139,92,246,0.08)';
        ctx.lineWidth = 1;
        for (var g = 0; g <= 4; g++) {
            var y = padT + chartH * g / 4;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + chartW, y);
            ctx.stroke();
        }

        // --- Y 轴标签（左：答题数） ---
        ctx.fillStyle = 'rgba(160,160,160,0.7)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        for (var yl = 0; yl <= 4; yl++) {
            var val = Math.round(maxCount * (4 - yl) / 4);
            ctx.fillText(val, padL - 4, padT + chartH * yl / 4 + 3);
        }

        // --- Y 轴标签（右：正确率%） ---
        ctx.textAlign = 'left';
        for (var yr = 0; yr <= 4; yr++) {
            var pct = Math.round(100 * (4 - yr) / 4);
            ctx.fillText(pct + '%', padL + chartW + 4, padT + chartH * yr / 4 + 3);
        }

        // --- X 轴标签（日期） ---
        ctx.textAlign = 'center';
        for (var x = 0; x < days; x++) {
            if (x % 2 === 0 || x === days - 1) {
                var d = dayData[x].date;
                var label = (d.getMonth() + 1) + '/' + d.getDate();
                ctx.fillText(label, padL + stepX * x, h - 8);
            }
        }

        // --- 答题数柱状图 ---
        var barW = stepX * 0.5;
        for (var b = 0; b < days; b++) {
            var bx = padL + stepX * b - barW / 2;
            var bh = (dayData[b].count / maxCount) * chartH;
            var by = padT + chartH - bh;
            var grad = ctx.createLinearGradient(0, by, 0, by + bh);
            grad.addColorStop(0, 'rgba(139,92,246,0.6)');
            grad.addColorStop(1, 'rgba(139,92,246,0.15)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(bx, by, barW, bh, 3) : ctx.rect(bx, by, barW, bh);
            ctx.fill();
        }

        // --- 正确率折线图 ---
        ctx.strokeStyle = '#F472B6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        var started = false;
        for (var p = 0; p < days; p++) {
            var px = padL + stepX * p;
            var py = padT + chartH * (1 - dayData[p].acc / 100);
            if (dayData[p].count > 0) {
                if (!started) { ctx.moveTo(px, py); started = true; }
                else ctx.lineTo(px, py);
            }
        }
        ctx.stroke();

        // 折线上的圆点
        ctx.fillStyle = '#F472B6';
        for (var pt = 0; pt < days; pt++) {
            if (dayData[pt].count > 0) {
                var cpx = padL + stepX * pt;
                var cpy = padT + chartH * (1 - dayData[pt].acc / 100);
                ctx.beginPath();
                ctx.arc(cpx, cpy, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- 图例 ---
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(139,92,246,0.6)';
        ctx.fillRect(padL, 4, 12, 8);
        ctx.fillStyle = 'rgba(160,160,160,0.8)';
        ctx.fillText('答题数', padL + 16, 12);
        ctx.strokeStyle = '#F472B6';
        ctx.beginPath();
        ctx.moveTo(padL + 60, 8);
        ctx.lineTo(padL + 72, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(padL + 66, 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(160,160,160,0.8)';
        ctx.fillText('正确率', padL + 78, 12);
    }

    A.renderTrendChart = renderTrendChart;
})(App);
