        function enterGuide() {
            window.location.href = "intro.html";
        }

        (function () {
            const bg = document.getElementById('titleBackground');

            // params (kept)
            const baseRadius = window.innerWidth < 700 ? 12 : 26.4;
            const speed = 0.48;
            const mouseStrength = 6.6;
            const centerOffsetX = -5;
            const centerOffsetY = -5;
            const scale = 1.1;

            let t = 0;
            let last = performance.now();
            let mouseTargetX = 0, mouseTargetY = 0;
            let mouseX = 0, mouseY = 0;
            let radius = baseRadius;

            function onResize() {
                radius = window.innerWidth < 700 ? 9 : baseRadius;
            }
            window.addEventListener('resize', onResize, { passive: true });

            function onMouseMove(e) {
                const nx = (e.clientX / window.innerWidth) - 0.5;
                const ny = (e.clientY / window.innerHeight) - 0.5;
                mouseTargetX = nx * mouseStrength;
                mouseTargetY = ny * mouseStrength;
            }
            function onTouchMove(e) {
                if (!e.touches || e.touches.length === 0) return;
                const t0 = e.touches[0];
                onMouseMove({ clientX: t0.clientX, clientY: t0.clientY });
            }
            window.addEventListener('mousemove', onMouseMove, { passive: true });
            window.addEventListener('touchmove', onTouchMove, { passive: true });

            function loop(now) {
                const dt = (now - last) / 1000;
                last = now;
                t += dt * speed;

                const x = Math.sin(t) * radius;
                const y = Math.cos(t * 0.9) * (radius * 0.6);

                const ease = 0.12;
                mouseX += (mouseTargetX - mouseX) * ease;
                mouseY += (mouseTargetY - mouseY) * ease;

                const totalX = x + mouseX;
                const totalY = y + mouseY;

                bg.style.transform = `translate(${centerOffsetX}%, ${centerOffsetY}%) translate(${totalX}px, ${totalY}px) scale(${scale})`;

                requestAnimationFrame(loop);
            }

            requestAnimationFrame(loop);
        })();
