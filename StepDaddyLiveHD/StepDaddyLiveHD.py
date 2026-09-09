import reflex as rx
import StepDaddyLiveHD.pages
from typing import List
from StepDaddyLiveHD import backend
from StepDaddyLiveHD.components import navbar, card
from StepDaddyLiveHD.step_daddy import Channel


class State(rx.State):
    channels: List[Channel] = []
    search_query: str = ""
    auto_hide_dead: bool = True

    @rx.var
    def filtered_channels(self) -> List[Channel]:
        channels = self.channels
        if self.auto_hide_dead:
            channels = [ch for ch in channels if not ch.dead]
        if not self.search_query:
            return channels
        return [ch for ch in channels if self.search_query.lower() in ch.name.lower()]

    @rx.var
    def dead_count(self) -> int:
        return len([ch for ch in self.channels if ch.dead])

    async def on_load(self):
        self.channels = backend.get_channels()

    @rx.event
    def set_search_query(self, value: str):
        self.search_query = value

    @rx.event
    def set_auto_hide_dead(self, value: bool):
        self.auto_hide_dead = value


@rx.page("/legacy", on_load=State.on_load)
def index() -> rx.Component:
    return rx.box(
        navbar(
            rx.vstack(
                rx.box(
                    rx.input(
                        rx.input.slot(
                            rx.icon("search"),
                        ),
                        placeholder="Search channels...",
                        on_change=State.set_search_query,
                        value=State.search_query,
                        width="100%",
                        max_width="25rem",
                        size="3",
                    ),
                ),
                rx.hstack(
                    rx.switch(
                        checked=State.auto_hide_dead,
                        on_change=State.set_auto_hide_dead,
                    ),
                    rx.text("Auto-hide dead channels"),
                    rx.badge(
                        rx.text("Dead channels:"),
                        rx.text(State.dead_count),
                        color_scheme="red",
                        variant="soft",
                    ),
                    spacing="2",
                ),
                align="start",
                spacing="2",
            ),
        ),
        rx.center(
            rx.cond(
                State.channels,
                rx.grid(
                    rx.foreach(
                        State.filtered_channels,
                        lambda channel: card(channel),
                    ),
                    grid_template_columns="repeat(auto-fill, minmax(250px, 1fr))",
                    spacing=rx.breakpoints(
                        initial="4",
                        sm="6",
                        lg="9"
                    ),
                    width="100%",
                ),
                rx.center(
                    rx.spinner(),
                    height="50vh",
                ),
            ),
            padding="1rem",
            padding_top="10rem",
        ),
    )


app = rx.App(
    theme=rx.theme(
        appearance="dark",
        accent_color="red",
    ),
    api_transformer=backend.fastapi_app,
)

app.register_lifespan_task(backend.update_channels)
